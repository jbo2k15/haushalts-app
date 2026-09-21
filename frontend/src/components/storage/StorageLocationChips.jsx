import { Settings } from 'lucide-react'
import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'

// Auswahl des aktiven Lagerorts (TODO.md "Vorrat: Orts-Chips + sticky
// Kategorie-Header") - horizontal scrollbare Chips statt gleich breiter
// Reiter, damit auch 7-8 Orte auf dem Handy noch funktionieren (jeder Chip
// ist nur so breit wie sein Name, der Rest ist wegwischbar statt die
// Schrift zu schrumpfen). Eigene Karte mit Label+Zähler analog zur
// Einkaufsliste-Kopfzeile, damit die Auswahl nicht zwischen den
// Nachbar-Karten (Einkaufsliste/Sortierung) optisch untergeht.
export default function StorageLocationChips({ locations, activeLocationId, onSelect, isAdmin, onManageLocations }) {
  return (
    <Card className="overflow-hidden mb-3 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Lagerort</span>
        <div className="flex items-center gap-2">
          <Badge tone="primary">{locations.length} {locations.length === 1 ? 'Ort' : 'Orte'}</Badge>
          {isAdmin && (
            <button
              onClick={onManageLocations}
              aria-label="Orte verwalten"
              className="w-11 h-11 -my-3 -mr-1 flex items-center justify-center text-ink-faint hover:text-ink"
            >
              <Settings size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {locations.map(location => (
            <button
              key={location.id}
              onClick={() => onSelect(location.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap ${
                location.id === activeLocationId
                  ? 'bg-primary-container text-on-primary-container font-medium'
                  : 'border border-outline-strong text-ink-muted'
              }`}
            >
              {location.name}
            </button>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-r from-transparent to-surface-container"
        />
      </div>
    </Card>
  )
}
