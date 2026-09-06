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
  const [quantity, setQuantity] = useState(item.quantity)
  const minQuantity = item.minQuantity ?? defaultMinQuantity

  async function changeQuantity(delta) {
    const next = Math.max(0, quantity + delta)
    setQuantity(next) // optimistisch, Server bestätigt gleich
    await api.patch(`/storage/items/${item.id}/quantity`, { quantity: next })
    await onChanged()
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
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => changeQuantity(-1)} aria-label="Menge verringern" className="w-6 h-6 rounded-control border border-outline-strong text-sm leading-none">−</button>
        <span className={`text-sm font-medium min-w-[1.5rem] text-center ${quantityClass(quantity, minQuantity)}`} data-testid="item-quantity">{quantity}</span>
        <button onClick={() => changeQuantity(1)} aria-label="Menge erhöhen" className="w-6 h-6 rounded-control border border-outline-strong text-sm leading-none">+</button>
      </div>
      <button onClick={handleDelete} aria-label={`${item.name} löschen`} className="text-danger text-xs shrink-0">Löschen</button>
    </div>
  )
}
