import { useState } from 'react'
import { api } from '../../api/client.js'
import { useDialog } from '../../context/DialogContext.jsx'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import { inputCls } from '../admin/constants.js'

// Einstellungen (nur Admins): alles rund ums Familien-Display. Eigener
// Abschnitt statt Teil der Nutzerverwaltung, damit sich das Feature sauber
// entfernen laesst.
//
// - Profile: Personen ohne Anmeldung (z. B. Kinder), die am Display als
//   Erlediger gewaehlt werden koennen und Punkte sammeln.
// - Farben: Anzeigefarbe pro Person, passend zum Familienkalender.

const DEFAULT_COLOR = '#4A5568'

function ColorInput({ id, value, onChange, label }) {
  return (
    <input
      id={id}
      type="color"
      aria-label={label}
      value={value || DEFAULT_COLOR}
      onChange={e => onChange(e.target.value)}
      className="w-11 h-11 shrink-0 rounded-control border border-outline bg-surface-container-high p-1"
    />
  )
}

export default function DisplayAdminSection({ users, onChanged }) {
  const dialog = useDialog()
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)

  const approved = users.filter(u => u.approved)

  async function addProfile(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/users/profiles', { name: name.trim(), color })
      setName('')
      setColor(DEFAULT_COLOR)
      onChanged()
    } catch (err) {
      dialog.alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function setUserColor(id, next) {
    try {
      await api.put(`/users/${id}/color`, { color: next })
      onChanged()
    } catch (err) {
      dialog.alert(err.message)
    }
  }

  return (
    <section className="space-y-2" data-testid="display-admin-section">
      <h2 className="font-medium text-ink">Familien-Display <span className="text-xs text-ink-faint font-normal">(gilt für alle)</span></h2>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 bg-surface-container-high border-b border-outline">
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Farben</h3>
          <p className="text-xs text-ink-faint mt-1">So erscheint jede Person auf dem Display, am besten wie im Familienkalender.</p>
        </div>
        {approved.length === 0 && <p className="px-4 py-3 text-sm text-ink-faint">Noch keine Personen.</p>}
        {approved.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-2 border-b border-outline last:border-b-0" data-testid="display-color-row">
            {/* Unkontrolliert + Speichern beim Verlassen: ein Farbwaehler feuert beim
                Ziehen laufend Aenderungen, das wuerde sonst je einen Request ausloesen. */}
            <input
              id={`display-color-${u.id}`}
              key={u.color || 'none'}
              type="color"
              aria-label={`Farbe von ${u.name}`}
              defaultValue={u.color || DEFAULT_COLOR}
              onBlur={e => { if (e.target.value.toUpperCase() !== (u.color || '').toUpperCase()) setUserColor(u.id, e.target.value) }}
              className="w-11 h-11 shrink-0 rounded-control border border-outline bg-surface-container-high p-1"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{u.name}</p>
              <p className="text-xs text-ink-faint">{u.kind === 'profile' ? 'Profil ohne Anmeldung' : 'Konto'}{u.color ? '' : ' · noch keine Farbe gewählt'}</p>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <form onSubmit={addProfile} className="space-y-2">
          <label htmlFor="display-profile-name" className="block text-sm text-ink-muted">Profil ohne Anmeldung hinzufügen</label>
          <p className="text-xs text-ink-faint">
            Für Personen ohne eigenes Konto, zum Beispiel Kinder. Ein Profil kann am Display als Erlediger gewählt werden und sammelt Punkte, kann sich aber nicht anmelden und zählt nicht in der Fairness-Statistik.
          </p>
          <div className="flex items-center gap-2">
            <ColorInput id="display-profile-color" label="Farbe des neuen Profils" value={color} onChange={setColor} />
            <input id="display-profile-name" className={inputCls} maxLength={100} placeholder="Name" value={name}
              onChange={e => setName(e.target.value)} data-testid="display-profile-name" />
            <Button type="submit" variant="primary" disabled={saving || !name.trim()} className="shrink-0" data-testid="display-profile-add">Anlegen</Button>
          </div>
        </form>
      </Card>
    </section>
  )
}
