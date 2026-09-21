import { useEffect, useState, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { api } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useDialog } from '../context/DialogContext.jsx'
import LocationSection from '../components/storage/LocationSection.jsx'
import ShoppingListSection from '../components/storage/ShoppingListSection.jsx'
import StorageLocationChips from '../components/storage/StorageLocationChips.jsx'
import ManageLocationsModal from '../components/storage/ManageLocationsModal.jsx'
import ItemFormModal from '../components/storage/ItemFormModal.jsx'
import Card from '../components/ui/Card.jsx'

// Persönlicher, geräteweiser Anzeigemodus (wie Zoom-Stufe/Design) - keine
// geteilte Haushalts-Einstellung. Ändert nie den gespeicherten sortOrder,
// sortiert nur die Anzeige der Artikel je Kategorie um.
const SORT_MODE_KEY = 'storage-sort-mode'
// Welcher Ort zuletzt aktiv war (TODO.md "Vorrat: Orts-Chips + sticky
// Kategorie-Header") - ebenfalls persönlich/geräteweise, kein Haushalts-Sync.
const ACTIVE_LOCATION_KEY = 'storage-active-location'

export default function Storage() {
  const { user } = useAuth()
  const dialog = useDialog()
  const isAdmin = user?.role === 'admin'

  const [locations, setLocations] = useState(null)
  const [autocomplete, setAutocomplete] = useState({ itemNames: [], categoryNames: [] })
  const [sortMode, setSortMode] = useState(() => localStorage.getItem(SORT_MODE_KEY) || 'manual')
  const [activeLocationId, setActiveLocationId] = useState(() => localStorage.getItem(ACTIVE_LOCATION_KEY) || null)
  const [manageLocationsOpen, setManageLocationsOpen] = useState(false)
  const [modalTarget, setModalTarget] = useState(null) // { categoryId, item? }
  const [refreshKey, setRefreshKey] = useState(0)

  function selectLocation(id) {
    setActiveLocationId(id)
    if (id) localStorage.setItem(ACTIVE_LOCATION_KEY, id)
    else localStorage.removeItem(ACTIVE_LOCATION_KEY)
  }

  const load = useCallback(async () => {
    const [locs, ac] = await Promise.all([api.get('/storage/locations'), api.get('/storage/autocomplete')])
    setLocations(locs)
    setAutocomplete(ac)
    // ShoppingListSection lädt unabhängig (eigener Endpunkt /storage/low-stock)
    // und bekommt sonst nicht mit, dass sich der Bestand geändert hat.
    setRefreshKey(k => k + 1)
    // Aktiven Ort validieren - falls er gelöscht wurde (oder beim ersten
    // Aufruf noch keiner gesetzt ist), auf den ersten verfügbaren Ort
    // zurückfallen statt eine leere/verwaiste Auswahl zu zeigen.
    setActiveLocationId(current => {
      if (current && locs.some(l => l.id === current)) return current
      const fallback = locs[0]?.id ?? null
      if (fallback) localStorage.setItem(ACTIVE_LOCATION_KEY, fallback)
      else localStorage.removeItem(ACTIVE_LOCATION_KEY)
      return fallback
    })
  }, [])

  useEffect(() => { load() }, [load])

  function setMode(mode) {
    setSortMode(mode)
    localStorage.setItem(SORT_MODE_KEY, mode)
  }

  async function handleLocationDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = locations.findIndex(l => l.id === active.id)
    const newIndex = locations.findIndex(l => l.id === over.id)
    const reordered = arrayMove(locations, oldIndex, newIndex)
    setLocations(reordered)
    await api.post('/storage/locations/reorder', { orderedIds: reordered.map(l => l.id) })
  }

  async function handleAddLocation(name) {
    const created = await api.post('/storage/locations', { name })
    // Neu angelegter Ort wird sofort aktiv - man legt ihn ja an, um direkt
    // Kategorien/Artikel darin zu erfassen, nicht um ihn erstmal zu suchen.
    selectLocation(created.id)
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

        <ShoppingListSection refreshKey={refreshKey} onChanged={load} />

        {locations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-ink-faint mb-3">
              {isAdmin ? 'Noch kein Lagerort angelegt.' : 'Noch kein Lagerort vorhanden.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => setManageLocationsOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                + Lagerort anlegen
              </button>
            )}
          </div>
        ) : (
          <>
            <StorageLocationChips
              locations={locations}
              activeLocationId={activeLocationId}
              onSelect={selectLocation}
              isAdmin={isAdmin}
              onManageLocations={() => setManageLocationsOpen(true)}
            />

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

            {(() => {
              const activeLocation = locations.find(l => l.id === activeLocationId)
              if (!activeLocation) return null
              return (
                <LocationSection
                  location={activeLocation}
                  sortMode={sortMode}
                  autocomplete={autocomplete}
                  onChanged={load}
                  onAddItem={categoryId => setModalTarget({ categoryId })}
                  onEditItem={(categoryId, item) => setModalTarget({ categoryId, item })}
                />
              )
            })()}
          </>
        )}

        {isAdmin && manageLocationsOpen && (
          <ManageLocationsModal
            locations={locations}
            onClose={() => setManageLocationsOpen(false)}
            onChanged={load}
            onDragEnd={handleLocationDragEnd}
            onAddLocation={handleAddLocation}
            onDeleteLocation={handleDeleteLocation}
          />
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
