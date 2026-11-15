import { useEffect, useState } from 'react'
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
// - Display-Schluessel: Zugang fuer das Wanddisplay (z. B. Home Assistant),
//   getrennt von den Nutzerkonten. Der Klartext wird nur einmal angezeigt.

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

function formatDate(str) {
  return new Date(str).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function DisplayTokensCard() {
  const dialog = useDialog()
  const [enabled, setEnabled] = useState(null)
  const [tokens, setTokens] = useState([])
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const [status, list] = await Promise.all([api.get('/display/status'), api.get('/display/tokens')])
      setEnabled(status?.enabled === true)
      setTokens(Array.isArray(list) ? list : [])
    } catch {}
  }

  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const created = await api.post('/display/tokens', { name: name.trim() })
      setFresh(created)
      setCopied(false)
      setName('')
      load()
    } catch (err) {
      dialog.alert(err.message)
    }
  }

  async function remove(token) {
    if (!(await dialog.confirm({ title: 'Schlüssel löschen?', message: `"${token.name}" verliert sofort den Zugriff. Das Display zeigt dann keine Aufgaben mehr, bis du einen neuen Schlüssel einträgst.`, confirmLabel: 'Löschen', tone: 'danger' }))) return
    try {
      await api.delete(`/display/tokens/${token.id}`)
      if (fresh?.id === token.id) setFresh(null)
      load()
    } catch (err) {
      dialog.alert(err.message)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fresh.token)
      setCopied(true)
    } catch {
      dialog.alert('Kopieren nicht möglich. Bitte den Schlüssel von Hand markieren und kopieren.')
    }
  }

  return (
    <Card className="overflow-hidden" data-testid="display-tokens-card">
      <div className="px-4 py-3 bg-surface-container-high border-b border-outline">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Display-Schlüssel</h3>
        <p className="text-xs text-ink-muted mt-1">Zugang für das Wanddisplay. Ein Schlüssel darf nur die Display-Daten nutzen, nicht die übrige App.</p>
      </div>
      <div className="p-4 space-y-3">
        {enabled === false && (
          <p className="text-sm text-ink-faint" data-testid="display-disabled-hint">
            Der Display-Zugang ist am Server ausgeschaltet. Setze <code className="text-xs">DISPLAY_API_ENABLED=true</code> in der Server-Konfiguration und starte die App neu. Schlüssel kannst du schon jetzt anlegen.
          </p>
        )}
        {fresh && (
          <div className="space-y-2 rounded-control border border-outline p-3" data-testid="display-token-fresh">
            <p className="text-sm text-ink">Neuer Schlüssel für „{fresh.name}“. Er wird nur jetzt angezeigt, kopiere ihn gleich.</p>
            <input readOnly aria-label="Neuer Display-Schlüssel" className={`${inputCls} font-mono text-xs`} value={fresh.token}
              onFocus={e => e.target.select()} data-testid="display-token-value" />
            <div className="flex gap-2">
              <Button variant="primary" onClick={copy}>{copied ? 'Kopiert' : 'Kopieren'}</Button>
              <Button onClick={() => setFresh(null)}>Ausblenden</Button>
            </div>
          </div>
        )}
        {tokens.length === 0 && <p className="text-sm text-ink-faint">Noch kein Schlüssel angelegt.</p>}
        {tokens.map(t => (
          <div key={t.id} className="flex items-center gap-3" data-testid="display-token-row">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{t.name}</p>
              <p className="text-xs text-ink-faint">
                Angelegt: {formatDate(t.createdAt)} · {t.lastUsedAt ? `zuletzt benutzt: ${formatDate(t.lastUsedAt)}` : 'noch nie benutzt'}
              </p>
            </div>
            <button onClick={() => remove(t)} className="text-xs bg-danger-container text-on-danger-container px-3 py-1.5 rounded-lg font-medium shrink-0" data-testid="display-token-delete">Löschen</button>
          </div>
        ))}
        <form onSubmit={create} className="flex items-center gap-2">
          <input aria-label="Name des neuen Schlüssels" className={inputCls} maxLength={60} placeholder="z. B. Wanddisplay Flur" value={name}
            onChange={e => setName(e.target.value)} data-testid="display-token-name" />
          <Button type="submit" variant="primary" disabled={!name.trim()} className="shrink-0" data-testid="display-token-add">Anlegen</Button>
        </form>
      </div>
    </Card>
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
          <p className="text-xs text-ink-muted mt-1">So erscheint jede Person auf dem Display, am besten wie im Familienkalender.</p>
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

      <DisplayTokensCard />
    </section>
  )
}
