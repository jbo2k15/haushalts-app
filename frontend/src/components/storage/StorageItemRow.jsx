import { useState } from 'react'
import { api } from '../../api/client.js'
import { useDialog } from '../../context/DialogContext.jsx'

// Ampel-Logik (TODO.md "Vorratsschrank-Verwaltung"): neutral (gut) ->
// warning-Token (niedrig, > 0 aber <= Mindestmenge) -> danger-Token (leer).
// Bewusst anders als bei der Fairness-Karte (dort wurde Grün/Rot als Wertung
// vermieden) - hier ist die Ampel-Metapher inhaltlich korrekt.
function quantityClass(quantity, minQuantity) {
  if (quantity === 0) return 'text-danger'
  if (quantity <= minQuantity) return 'text-on-warning-container bg-warning-container rounded px-1.5'
  return 'text-ink'
}

// Reine Darstellungs-Komponente (Menge, Ampel-Farbe, Löschen) - ohne eigenes
// Drag&Drop. Wird sowohl direkt (Auffüll-Sortiermodus, keine Sortable-
// Umgebung vorhanden) als auch von SortableStorageItem (manueller Modus,
// innerhalb eines dnd-kit SortableContext) verwendet.
export default function StorageItemRow({ item, defaultMinQuantity, onChanged, onEdit, dragHandleProps, setNodeRef, style }) {
  const dialog = useDialog()
  // Nur ein optimistisches Override waehrend die Anfrage laeuft (wie
  // TaskRow.jsx's optimistic-State) - kein dauerhafter lokaler Mengen-State.
  // item.quantity bleibt sonst die alleinige Wahrheitsquelle, auch wenn sich
  // derselbe Artikel anderswo aendert (z.B. Abhaken in der Einkaufsliste).
  const [pendingQuantity, setPendingQuantity] = useState(null)
  const quantity = pendingQuantity ?? item.quantity
  const minQuantity = item.minQuantity ?? defaultMinQuantity

  async function changeQuantity(delta) {
    const next = Math.max(0, quantity + delta)
    setPendingQuantity(next)
    try {
      await api.patch(`/storage/items/${item.id}/quantity`, { quantity: next })
      await onChanged()
    } finally {
      setPendingQuantity(null)
    }
  }

  async function handleDelete(e) {
    e.stopPropagation()
    const ok = await dialog.confirm({
      title: 'Artikel löschen?',
      message: `"${item.name}" wird komplett aus der Liste entfernt (nicht nur Menge auf 0).`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    })
    if (!ok) return
    await api.delete(`/storage/items/${item.id}`)
    await onChanged()
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 border-t border-outline" data-testid="storage-item-row" data-item-name={item.name}>
      {dragHandleProps && (
        <span {...dragHandleProps} style={{ touchAction: 'none' }} className="text-ink-faint cursor-grab active:cursor-grabbing text-sm" data-testid="item-drag-handle">⠿</span>
      )}
      <button onClick={onEdit} className="flex-1 text-left text-sm text-ink truncate">
        {item.name}
        {item.unit && <span className="text-ink-faint text-xs ml-1">({item.unit})</span>}
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => changeQuantity(-1)} aria-label="Menge verringern" className="w-8 h-8 rounded-control border border-outline-strong text-base leading-none touch-manipulation">−</button>
        <span className={`text-sm font-medium min-w-[1.5rem] text-center ${quantityClass(quantity, minQuantity)}`} data-testid="item-quantity">{quantity}</span>
        <button onClick={() => changeQuantity(1)} aria-label="Menge erhöhen" className="w-8 h-8 rounded-control border border-outline-strong text-base leading-none touch-manipulation">+</button>
      </div>
      <button onClick={handleDelete} aria-label={`${item.name} löschen`} className="text-danger text-xs shrink-0 px-2 py-2 -my-2 touch-manipulation">Löschen</button>
    </div>
  )
}
