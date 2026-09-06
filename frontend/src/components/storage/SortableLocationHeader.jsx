import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../api/client.js'
import Button from '../ui/Button.jsx'

// Lagerort-Rahmen mit Drag-Handle + Umbenennen/Löschen - nur für Admins
// gerendert (siehe Storage.jsx), da Orte umsortieren/umbenennen/löschen
// Admin-only ist (TODO.md "Vorratsschrank-Verwaltung").
export default function SortableLocationHeader({ location, onRename, onDelete, children }) {
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
    <div ref={setNodeRef} style={style} className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span {...attributes} {...listeners} style={{ touchAction: 'none' }} className="text-ink-faint cursor-grab active:cursor-grabbing" data-testid="location-drag-handle">⠿</span>
        {editing ? (
          <form onSubmit={handleRename} className="flex-1 flex gap-2">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} className="flex-1 rounded-control border border-outline-strong px-2 py-1 text-xs bg-surface-container" />
            <Button type="submit" size="md" className="text-xs px-2 py-1">OK</Button>
          </form>
        ) : (
          <>
            <p className="flex-1 text-xs font-semibold text-ink-muted uppercase tracking-wide">{location.name}</p>
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Bearb.</button>
            <button onClick={onDelete} className="text-xs text-danger hover:underline">Löschen</button>
          </>
        )}
      </div>
      {children}
    </div>
  )
}
