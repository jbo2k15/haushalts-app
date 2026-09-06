import { useEffect, useState, useCallback } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useDialog } from '../context/DialogContext.jsx'
import LocationSection from '../components/storage/LocationSection.jsx'
import SortableLocationHeader from '../components/storage/SortableLocationHeader.jsx'
import ItemFormModal from '../components/storage/ItemFormModal.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'

// Persönlicher, geräteweiser Anzeigemodus (wie Zoom-Stufe/Design) - keine
// geteilte Haushalts-Einstellung. Ändert nie den gespeicherten sortOrder,
// sortiert nur die Anzeige der Artikel je Kategorie um.
const SORT_MODE_KEY = 'storage-sort-mode'

export default function Storage() {
  const { user } = useAuth()
  const dialog = useDialog()
  const isAdmin = user?.role === 'admin'

  const [locations, setLocations] = useState(null)
  const [autocomplete, setAutocomplete] = useState({ itemNames: [], categoryNames: [] })
  const [sortMode, setSortMode] = useState(() => localStorage.getItem(SORT_MODE_KEY) || 'manual')
  const [addingLocation, setAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [modalTarget, setModalTarget] = useState(null) // { categoryId, item? }

  const load = useCallback(async () => {
    const [locs, ac] = await Promise.all([api.get('/storage/locations'), api.get('/storage/autocomplete')])
    setLocations(locs)
    setAutocomplete(ac)
  }, [])

  useEffect(() => { load() }, [load])

  function setMode(mode) {
    setSortMode(mode)
    localStorage.setItem(SORT_MODE_KEY, mode)
  }

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleLocationDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = locations.findIndex(l => l.id === active.id)
    const newIndex = locations.findIndex(l => l.id === over.id)
    const reordered = arrayMove(locations, oldIndex, newIndex)
    setLocations(reordered)
    await api.post('/storage/locations/reorder', { orderedIds: reordered.map(l => l.id) })
  }

  async function handleAddLocation(e) {
    e.preventDefault()
    if (!newLocationName.trim()) return
    await api.post('/storage/locations', { name: newLocationName.trim() })
    setNewLocationName('')
    setAddingLocation(false)
    await load()
  }

  async function handleDeleteLocation(location) {
    const ok = await dialog.confirm({
      title: 'Lagerort löschen?',
      message: `"${location.name}" samt aller Kategorien und Artikel wird unwiderruflich gelöscht.`,
      confirmLabel: 'Löschen',
      tone: 'danger',
    })
    if (!ok) return
    await api.delete(`/storage/locations/${location.id}`)
    await load()
  }

  if (!locations) {
    return (
      <div className="min-h-screen bg-surface flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <header className="flex items-center justify-between py-3">
          <h1 className="text-xl font-semibold text-ink">Vorrat</h1>
        </header>

        <Card className="overflow-hidden mb-3">
          <div className="flex text-xs font-medium">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 ${sortMode === 'manual' ? 'bg-primary-container text-on-primary-container' : 'text-ink-muted'}`}
            >
              Meine Sortierung
            </button>
            <button
              onClick={() => setMode('restock')}
              className={`flex-1 py-2 ${sortMode === 'restock' ? 'bg-primary-container text-on-primary-container' : 'text-ink-muted'}`}
            >
              Was ist aufzufüllen
            </button>
          </div>
        </Card>

        {locations.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-12">
            {isAdmin ? 'Noch kein Lagerort angelegt.' : 'Noch kein Lagerort vorhanden.'}
          </p>
        )}

        {isAdmin ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLocationDragEnd}>
            <SortableContext items={locations.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {locations.map(location => (
                <SortableLocationHeader key={location.id} location={location} onRename={load} onDelete={() => handleDeleteLocation(location)}>
                  <LocationSection
                    location={location}
                    sortMode={sortMode}
                    autocomplete={autocomplete}
                    onChanged={load}
                    onAddItem={categoryId => setModalTarget({ categoryId })}
                    onEditItem={(categoryId, item) => setModalTarget({ categoryId, item })}
                  />
                </SortableLocationHeader>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          locations.map(location => (
            <div key={location.id} className="mb-4">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1.5">{location.name}</p>
              <LocationSection
                location={location}
                sortMode={sortMode}
                autocomplete={autocomplete}
                onChanged={load}
                onAddItem={categoryId => setModalTarget({ categoryId })}
                onEditItem={(categoryId, item) => setModalTarget({ categoryId, item })}
              />
            </div>
          ))
        )}

        {isAdmin && (
          addingLocation ? (
            <form onSubmit={handleAddLocation} className="bg-surface-container rounded-card border border-outline p-4 flex gap-2">
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
          )
        )}
      </div>

      {modalTarget && (
        <ItemFormModal
          categoryId={modalTarget.categoryId}
          item={modalTarget.item}
          autocomplete={autocomplete}
          locations={locations}
          onClose={() => setModalTarget(null)}
          onSaved={async () => { setModalTarget(null); await load() }}
        />
      )}
    </div>
  )
}
