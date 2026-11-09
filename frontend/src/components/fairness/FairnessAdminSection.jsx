import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useDialog } from '../../context/DialogContext.jsx'
import Card from '../ui/Card.jsx'
import Switch from '../ui/Switch.jsx'
import Button from '../ui/Button.jsx'
import { inputCls } from '../admin/constants.js'
import { useFairnessConfig, refreshFairnessConfig } from './useFairnessConfig.js'

// Einstellungen (nur Admins): wer die Fairness-Karte sieht und welche
// Urlaubszeiten herausgerechnet werden. Eigener Abschnitt statt Teil der
// Nutzerverwaltung, damit sich das Feature sauber entfernen laesst.

const fmt = d => d.split('-').reverse().join('.')

function rangeLabel(v) {
  if (!v.endDate) return `ab ${fmt(v.startDate)}`
  const sameYear = v.startDate.slice(0, 4) === v.endDate.slice(0, 4)
  const start = sameYear ? fmt(v.startDate).slice(0, 6) : fmt(v.startDate)
  return `${start} – ${fmt(v.endDate)}`
}

function detailLabel(v) {
  const n = `${v.days} ${v.days === 1 ? 'Urlaubstag' : 'Urlaubstage'}`
  if (!v.endDate) return `${n} bisher · läuft noch (Urlaubsmodus)`
  return `${n} · ${v.source === 'manual' ? 'nachgetragen' : 'über den Urlaubsmodus'}`
}

function VacationForm({ initial, onSave, onCancel, idPrefix }) {
  const [startDate, setStartDate] = useState(initial?.startDate || '')
  const [endDate, setEndDate] = useState(initial?.endDate || '')
  const open = initial && !initial.endDate
  return (
    <form
      className="space-y-2 px-4 py-3 bg-surface-container-high"
      onSubmit={e => { e.preventDefault(); onSave({ startDate, endDate: endDate || null }) }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-from`} className="block text-xs text-ink-muted mb-1">Von</label>
          <input id={`${idPrefix}-from`} type="date" required className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-to`} className="block text-xs text-ink-muted mb-1">Bis {open && '(leer = läuft noch)'}</label>
          <input id={`${idPrefix}-to`} type="date" required={!open} className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1">Speichern</Button>
        <Button onClick={onCancel} className="flex-1">Abbrechen</Button>
      </div>
    </form>
  )
}

function UserFairness({ entry, currentUserId, onChanged }) {
  const dialog = useDialog()
  const [editing, setEditing] = useState(null) // 'new' | vacation id | null

  async function run(fn) {
    try { await fn(); setEditing(null); await onChanged() } catch (err) { dialog.alert(err.message) }
  }

  async function toggleVisibility() {
    await run(() => api.put(`/fairness/admin/users/${entry.id}/visibility`, { showFairness: !entry.showFairness }))
    if (entry.id === currentUserId) refreshFairnessConfig()
  }

  async function remove(v) {
    const ok = await dialog.confirm({ title: 'Urlaubszeit löschen?', message: `${rangeLabel(v)} wirklich löschen?`, confirmLabel: 'Löschen', tone: 'danger' })
    if (ok) await run(() => api.delete(`/fairness/admin/vacations/${v.id}`))
  }

  return (
    <div className="border-b border-outline last:border-b-0" data-testid="fairness-user" data-user-name={entry.name}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span id={`fair-label-${entry.id}`} className="flex-1 text-sm text-ink">
          <span className="font-medium">{entry.name}</span>
          <span className="block text-xs text-ink-muted">Fairness-Statistik sehen</span>
        </span>
        <Switch checked={entry.showFairness} onChange={toggleVisibility} aria-labelledby={`fair-label-${entry.id}`} data-testid="fairness-visibility" />
      </div>

      <div className="px-4 pb-2">
        <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide">Urlaubszeiten</h3>
        {entry.vacations.length === 0 && <p className="text-xs text-ink-faint py-1.5">Keine eingetragen</p>}
      </div>
      {entry.vacations.map(v => (
        editing === v.id
          ? <VacationForm key={v.id} idPrefix={`vac-${v.id}`} initial={v} onCancel={() => setEditing(null)}
              onSave={body => run(() => api.put(`/fairness/admin/vacations/${v.id}`, body))} />
          : (
            <div key={v.id} className="flex items-center gap-2 px-4 py-1.5" data-testid="vacation-row">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{rangeLabel(v)}</p>
                <p className="text-xs text-ink-muted">{detailLabel(v)}</p>
              </div>
              <button type="button" onClick={() => setEditing(v.id)} className="min-h-11 px-2 text-xs text-primary hover:underline" aria-label={`Urlaubszeit ${rangeLabel(v)} bearbeiten`}>Bearb.</button>
              <button type="button" onClick={() => remove(v)} className="min-h-11 px-2 text-xs text-danger hover:underline" aria-label={`Urlaubszeit ${rangeLabel(v)} löschen`}>Löschen</button>
            </div>
          )
      ))}
      {editing === 'new'
        ? <VacationForm idPrefix={`vac-new-${entry.id}`} onCancel={() => setEditing(null)}
            onSave={body => run(() => api.post('/fairness/admin/vacations', { userId: entry.id, ...body }))} />
        : (
          <div className="px-4 pb-3 pt-1">
            <Button onClick={() => setEditing('new')} className="w-full" data-testid="vacation-add">+ Urlaubszeit nachtragen</Button>
          </div>
        )}
    </div>
  )
}

const COUNT_MODES = [
  { value: 'count', label: 'Anzahl', hint: 'Jede Erledigung zählt 1' },
  { value: 'weighted', label: 'Gewichtet', hint: 'Punkte nach Aufwand' },
]

// Zaehlweise fuer Pokale (Ruhmeshalle) und Statistik (Startseite).
function CountModeSetting({ countMode }) {
  const dialog = useDialog()
  const [saving, setSaving] = useState(false)

  async function choose(value) {
    if (value === countMode || saving) return
    setSaving(true)
    try {
      await api.put('/fairness/admin/settings', { countMode: value })
      await refreshFairnessConfig()
    } catch (err) {
      dialog.alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="px-4 py-3 border-b border-outline space-y-1.5">
      <legend className="sr-only">Rangliste und Statistik zählen</legend>
      <p className="text-sm text-ink" aria-hidden="true">Rangliste und Statistik zählen</p>
      <div className="grid grid-cols-2 gap-1.5 bg-surface-container-high rounded-control p-1">
        {COUNT_MODES.map(mode => {
          const active = countMode === mode.value
          return (
            <button
              type="button"
              key={mode.value}
              aria-pressed={active}
              disabled={saving}
              data-testid={`count-mode-${mode.value}`}
              onClick={() => choose(mode.value)}
              className={`min-h-11 rounded-lg px-1 py-1.5 text-center ${active ? 'bg-surface-container text-ink shadow-sm' : 'text-ink-muted'}`}
            >
              <span className="block text-sm font-semibold">{mode.label}</span>
              <span className="block text-xs">{mode.hint}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-ink-muted">
        Beim Umstellen werden die Pokale aus dem gespeicherten Verlauf (2 Jahre) neu berechnet; zurückstellen stellt den alten Stand wieder her.
      </p>
    </fieldset>
  )
}

export default function FairnessAdminSection({ currentUserId }) {
  const config = useFairnessConfig()
  const [entries, setEntries] = useState([])
  const enabled = config?.enabled === true

  async function load() {
    try { setEntries(await api.get('/fairness/admin/users')) } catch {}
  }

  useEffect(() => { if (enabled) load() }, [enabled])

  if (!enabled) return null

  return (
    <section className="space-y-2" data-testid="fairness-admin">
      <h2 className="font-medium text-ink">Fairness-Statistik <span className="text-xs text-ink-faint font-normal">(gilt für alle)</span></h2>
      <Card className="overflow-hidden">
        <CountModeSetting countMode={config.countMode} />
        {entries.map(entry => (
          <UserFairness key={entry.id} entry={entry} currentUserId={currentUserId} onChanged={load} />
        ))}
      </Card>
      <p className="text-xs text-ink-muted">
        Die Fairness-Karte in der Ruhmeshalle sehen nur freigegebene Personen. Gezählt wird trotzdem für alle.
        Urlaubstage werden herausgerechnet; der Urlaubsmodus trägt sie automatisch ein, Ein- und Ausschalttag zählen als normale Tage.
      </p>
    </section>
  )
}
