import { useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { api } from '../../api/client.js'
import CategoryGroup from './CategoryGroup.jsx'
import Button from '../ui/Button.jsx'

// Kategorien innerhalb eines Lagerorts - Anlegen/Umsortieren offen für alle
// Haushaltsmitglieder (nur Lagerorte selbst sind Admin-only, siehe TODO.md).
export default function LocationSection({ location, sortMode, autocomplete, onChanged, onAddItem, onEditItem }) {
  const [categories, setCategories] = useState(location.categories)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // location.categories ändert sich nach jedem Reload (onChanged lädt die
  // ganze Seite neu und übergibt eine neue location-Prop) - lokalen State
  // damit synchron halten, statt zwei Wahrheitsquellen zu riskieren.
  if (location.categories !== categories && location.categories) {
    setCategories(location.categories)
  }

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = categories.findIndex(c => c.id === active.id)
    const newIndex = categories.findIndex(c => c.id === over.id)
    const reordered = arrayMove(categories, oldIndex, newIndex)
    setCategories(reordered)
    await api.post(`/storage/locations/${location.id}/categories/reorder`, { orderedIds: reordered.map(c => c.id) })
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    await api.post(`/storage/locations/${location.id}/categories`, { name: newCategoryName.trim() })
    setNewCategoryName('')
    setAddingCategory(false)
    await onChanged()
  }

  return (
    <div className="border border-outline rounded-card overflow-hidden bg-surface-container">
      {categories.length === 0 && (
        <p className="text-sm text-ink-faint p-4 text-center">Noch keine Kategorie</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {categories.map(category => (
            <CategoryGroup
              key={category.id}
              category={category}
              sortMode={sortMode}
              autocomplete={autocomplete}
              onChanged={onChanged}
              onAddItem={() => onAddItem(category.id)}
              onEditItem={item => onEditItem(category.id, item)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="p-2 border-t border-outline">
        {addingCategory ? (
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              autoFocus
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Name der Kategorie"
              list="storage-category-names"
              className="flex-1 rounded-control border border-outline-strong px-3 py-1.5 text-sm bg-surface-container"
            />
            <Button type="submit" size="md" className="text-xs">Anlegen</Button>
            <Button type="button" variant="ghost" size="md" className="text-xs" onClick={() => setAddingCategory(false)}>Abbrechen</Button>
          </form>
        ) : (
          <button onClick={() => setAddingCategory(true)} className="text-xs text-primary hover:underline">+ Kategorie</button>
        )}
      </div>

      <datalist id="storage-category-names">
        {autocomplete.categoryNames.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}
