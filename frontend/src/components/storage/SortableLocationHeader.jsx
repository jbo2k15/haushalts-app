import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../api/client.js'
import Button from '../ui/Button.jsx'

// Lagerort-Zeile mit Drag-Handle + Umbenennen/Löschen - nur für Admins
// gerendert, innerhalb von ManageLocationsModal.jsx (Orte umsortieren/
// umbenennen/löschen ist Admin-only, TODO.md "Vorratsschrank-Verwaltung").
// Zeigt nur den Ort selbst, keine Kategorien/Artikel mehr (die werden seit
// "Vorrat: Orts-Chips + sticky Kategorie-Header" getrennt für den jeweils
// aktiven Ort auf der Hauptseite gerendert, nicht mehr hier inline).
export default function SortableLocationHeader({ location, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: location.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)

  async function handleRename(e) {
    e.preventDefault()
    if (!name.trim()) return
    await api.put(`/storage/locations/${location.id}`, { name: name.trim() })
    setEditing(false)
    await onRename()
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 border-b border-outline last:border-b-0">
      <span {...attributes} {...listeners} style={{ touchAction: 'none' }} className="text-ink-faint cursor-grab active:cursor-grabbing" data-testid="location-drag-handle">⠿</span>
      {editing ? (
        <form onSubmit={handleRename} className="flex-1 flex gap-2">
          <input autoFocus aria-label="Name des Lagerorts" value={name} onChange={e => setName(e.target.value)} className="flex-1 rounded-control border border-outline-strong px-2 py-1 text-xs bg-surface-container" />
          <Button type="submit" size="md" className="text-xs px-2 py-1">OK</Button>
        </form>
      ) : (
        <>
          <p className="flex-1 text-sm text-ink">{location.name}</p>
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Bearb.</button>
          <button onClick={onDelete} className="text-xs text-danger hover:underline">Löschen</button>
        </>
      )}
    </div>
  )
}
