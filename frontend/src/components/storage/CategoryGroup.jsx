import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { api } from '../../api/client.js'
import { useDialog } from '../../context/DialogContext.jsx'
import SortableStorageItem from './SortableStorageItem.jsx'
import StorageItemRow from './StorageItemRow.jsx'

// Sortiert nach Bestand (aufsteigend), niedrigster zuerst - reine
// Anzeige-Umsortierung im "Was ist aufzufüllen"-Modus, ändert nie den
// gespeicherten sortOrder (siehe Storage.jsx-Kommentar zum Sortiermodus).
function forDisplay(items, sortMode) {
  if (sortMode !== 'restock') return items
  return [...items].sort((a, b) => a.quantity - b.quantity)
}

export default function CategoryGroup({ category, sortMode, autocomplete, onChanged, onAddItem, onEditItem }) {
  const dialog = useDialog()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [defaultMinQuantity, setDefaultMinQuantity] = useState(category.defaultMinQuantity)

  const items = category.items
  const displayItems = forDisplay(items, sortMode)
  // Drag&Drop nur im manuellen Modus sinnvoll - im Auffüll-Modus ist die
  // Reihenfolge ohnehin nur eine temporäre Anzeige-Sortierung.
  const dragEnabled = sortMode === 'manual'

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleItemDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    await api.post(`/storage/categories/${category.id}/items/reorder`, { orderedIds: reordered.map(i => i.id) })
    await onChanged()
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    await api.put(`/storage/categories/${category.id}`, { name: name.trim(), defaultMinQuantity: Number(defaultMinQuantity) || 0 })
    setEditing(false)
    await onChanged()
  }

  async function handleDelete() {
    const ok = await dialog.confirm({
      title: 'Kategorie löschen?',
      message: `"${category.name}" samt aller Artikel wird unwiderruflich gelöscht.`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    })
    if (!ok) return
    await api.delete(`/storage/categories/${category.id}`)
    await onChanged()
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="px-3 py-2 bg-surface-container-high border-t border-b border-outline flex items-center gap-2">
        <span {...attributes} {...listeners} style={{ touchAction: 'none' }} className="text-ink-faint cursor-grab active:cursor-grabbing text-sm" data-testid="category-drag-handle">⠿</span>
        {editing ? (
          <form onSubmit={handleSave} className="flex-1 flex items-center gap-2">
            <input autoFocus aria-label="Name der Kategorie" value={name} onChange={e => setName(e.target.value)} className="flex-1 rounded-control border border-outline-strong px-2 py-1 text-xs bg-surface-container" />
            <input
              type="number" min="0" value={defaultMinQuantity} onChange={e => setDefaultMinQuantity(e.target.value)}
              aria-label="Standard-Mindestmenge für Artikel dieser Kategorie"
              title="Standard-Mindestmenge für Artikel dieser Kategorie"
              className="w-14 rounded-control border border-outline-strong px-1 py-1 text-xs bg-surface-container"
            />
            <button type="submit" className="text-xs text-primary hover:underline shrink-0">OK</button>
          </form>
        ) : (
          <>
            <span className="flex-1 text-xs font-medium text-ink-muted uppercase tracking-wide">{category.name}</span>
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline shrink-0">Bearb.</button>
            <button onClick={handleDelete} className="text-xs text-danger hover:underline shrink-0">Löschen</button>
          </>
        )}
      </div>

      {items.length === 0 && <p className="text-xs text-ink-faint px-4 py-3">Keine Artikel</p>}

      {dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map(item => (
              <SortableStorageItem
                key={item.id}
                item={item}
                defaultMinQuantity={category.defaultMinQuantity}
                onChanged={onChanged}
                onEdit={() => onEditItem(item)}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        // Auffüll-Modus: rein präsentational, kein dnd-kit-Hook - dieser Zweig
        // wird bewusst außerhalb jedes DndContext gerendert (useSortable würde
        // sonst crashen, siehe SortableStorageItem-Kommentar).
        displayItems.map(item => (
          <StorageItemRow
            key={item.id}
            item={item}
            defaultMinQuantity={category.defaultMinQuantity}
            onChanged={onChanged}
            onEdit={() => onEditItem(item)}
          />
        ))
      )}

      <button onClick={onAddItem} className="text-xs text-primary hover:underline px-4 py-2 block">+ Artikel</button>
    </div>
  )
}
