import { useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import SortableLocationHeader from './SortableLocationHeader.jsx'
import Button from '../ui/Button.jsx'

// Admin-Verwaltung der Lagerorte (umbenennen/löschen/umsortieren) - vorher
// inline auf der Vorrat-Seite, jetzt als Modal ausgelagert (TODO.md "Vorrat:
// Orts-Chips + sticky Kategorie-Header"), da die Orte selbst nur noch als
// kleine Chips dargestellt werden und dort kein Platz für diese Aktionen
// ist. Reine Verschiebung des bisherigen Verhaltens, keine neue Logik -
// alle Handler kommen unverändert aus Storage.jsx (das dort load()/State
// hält, gleiches Muster wie ItemFormModal).
export default function ManageLocationsModal({ locations, onClose, onChanged, onDragEnd, onAddLocation, onDeleteLocation }) {
  const [addingLocation, setAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleSubmit(e) {
    e.preventDefault()
    if (!newLocationName.trim()) return
    await onAddLocation(newLocationName.trim())
    setNewLocationName('')
    setAddingLocation(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface-container rounded-modal w-full max-w-sm p-4 space-y-3 max-h-[80vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Orte verwalten"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Orte verwalten</h2>
          <button onClick={onClose} aria-label="Schließen" className="text-ink-faint hover:text-ink -m-1 p-1">✕</button>
        </div>

        {locations.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-4">Noch kein Lagerort angelegt.</p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={locations.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {locations.map(location => (
              <SortableLocationHeader
                key={location.id}
                location={location}
                onRename={onChanged}
                onDelete={() => onDeleteLocation(location)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {addingLocation ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              autoFocus
              value={newLocationName}
              onChange={e => setNewLocationName(e.target.value)}
              placeholder="Name des Lagerorts"
              className="flex-1 rounded-control border border-outline-strong px-3 py-2 text-sm bg-surface-container"
            />
            <Button type="submit" variant="primary">Anlegen</Button>
            <Button type="button" variant="ghost" onClick={() => setAddingLocation(false)}>Abbrechen</Button>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setAddingLocation(true)} className="w-full">+ Lagerort</Button>
        )}
      </div>
    </div>
  )
}
