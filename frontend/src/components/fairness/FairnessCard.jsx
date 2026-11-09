import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import Card from '../ui/Card.jsx'
import { useFairnessConfig } from './useFairnessConfig.js'
import { colorFor } from './colors.js'

// Fairness-Karte in der Ruhmeshalle: gewichteter Anteil pro Person ueber die
// letzten 30 Tage, Urlaub herausgerechnet. Rechnung: backend domain/fairness.js.
// Nur fuer freigegebene Nutzer sichtbar (sonst rendert die Karte nichts).

const TREND_TEXT = {
  'more-balanced': 'Ausgeglichener als in den 30 Tagen davor',
  'less-balanced': 'Ungleicher verteilt als in den 30 Tagen davor',
  similar: 'Ähnlich verteilt wie in den 30 Tagen davor',
}

const decimal = n => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const points = n => `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`
const days = n => `${n} ${n === 1 ? 'Urlaubstag' : 'Urlaubstage'}`

function shareLabel(persons) {
  return persons.map(p => `${p.name} ${p.share} Prozent`).join(', ')
}

function StackedBar({ persons, people, height = 'h-4', label }) {
  return (
    <div role="img" aria-label={label} className={`flex gap-[3px] ${height} rounded-full overflow-hidden`}>
      {persons.filter(p => p.share > 0).map(p => (
        <div key={p.id} className={colorFor(people, p.id)} style={{ width: `${p.share}%` }} />
      ))}
    </div>
  )
}

function Dot({ people, id }) {
  return <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-[3px] shrink-0 ${colorFor(people, id)}`} />
}

function AwayNotes({ mostlyAway }) {
  if (!mostlyAway?.length) return null
  return mostlyAway.map(p => (
    <p key={p.id} className="text-xs text-ink-muted">
      {p.reason === 'vacation' ? `${p.name} war fast den ganzen Zeitraum im Urlaub.` : `${p.name} ist erst seit Kurzem dabei.`}
    </p>
  ))
}

function Weeks({ weeks, people, asList }) {
  const notes = weeks.filter(w => w.lowData)
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide">Letzte 4 Wochen</h3>
      {weeks.map(w => {
        const text = w.persons.length === 0 ? '–' : w.persons.map(p => p.share).join(' / ')
        const label = w.persons.length === 0
          ? `${w.label}: keine Erledigungen`
          : `${w.label}: ${shareLabel(w.persons)}`
        return (
          <div key={w.from} data-testid="fairness-week" className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5">
            <span className="text-xs text-ink-muted">{w.label}</span>
            {asList || w.persons.length === 0
              ? <span className="sr-only">{label}</span>
              : <StackedBar persons={w.persons} people={people} height="h-2.5" label={label} />}
            {!asList && <span className="text-xs text-ink text-right tabular-nums" aria-hidden="true">{text}</span>}
            {asList && w.persons.length > 0 && (
              <span className="col-span-2 text-xs text-ink" aria-hidden="true">
                {w.persons.map(p => `${p.name} ${p.share} %`).join(', ')}
              </span>
            )}
          </div>
        )
      })}
      {notes.map(w => (
        <p key={w.from} className="text-xs text-ink-faint">
          {w.totalPoints === 0
            ? `${w.label}: keine Erledigungen.`
            : `${w.label}: nur ${points(w.totalPoints)} – Woche wenig aussagekräftig.`}
        </p>
      ))}
    </div>
  )
}

export function FairnessContent({ data }) {
  const { persons, people } = data
  const asList = people.length >= 5
  const sorted = [...persons].sort((a, b) => b.share - a.share)

  if (data.totalPoints === 0) {
    return <p className="text-sm text-ink-faint text-center py-2" data-testid="fairness-empty">Noch keine Erledigungen in diesem Zeitraum.</p>
  }

  return (
    <>
      <p className="text-sm text-ink-muted">
        Anteil an den erledigten Aufgaben, gewichtet nach Aufwand: Leicht zählt 1, Mittel 2, Aufwändig 3 Punkte.
        Urlaubstage werden herausgerechnet.
      </p>

      {data.lowData && (
        <p className="text-xs text-on-warning-container bg-warning-container rounded-control px-3 py-2">
          Noch wenig Daten – die Verteilung kann stark schwanken.
        </p>
      )}

      {persons.length > 0 && asList && (
        <ol className="space-y-1.5" aria-label="Anteile">
          {sorted.map(p => (
            <li key={p.id} data-testid="fairness-person" data-person-name={p.name} data-share={p.share} className="flex items-center gap-2 text-sm text-ink">
              <span className="font-medium">{p.name}</span>
              <span>— {p.share} %</span>
              <span className="text-xs text-ink-muted">
                ({points(p.points)}{p.vacationDays > 0 ? `, ${days(p.vacationDays)}` : ''})
              </span>
            </li>
          ))}
        </ol>
      )}

      {persons.length > 0 && !asList && (
        <>
          <StackedBar persons={persons} people={people} label={`Gewichteter Anteil: ${shareLabel(persons)}`} />
          <div className="grid grid-cols-2 gap-3">
            {persons.map(p => (
              <div key={p.id} data-testid="fairness-person" data-person-name={p.name} data-share={p.share} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Dot people={people} id={p.id} />
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                </div>
                <span className="text-2xl font-semibold text-ink">{p.share} %</span>
                <span className="text-xs text-ink-muted">{points(p.points)}</span>
                {p.vacationDays > 0 && <span className="text-xs text-ink-muted">{days(p.vacationDays)} herausgerechnet</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <AwayNotes mostlyAway={data.mostlyAway} />

      {data.trend && data.previous && (
        <p className="text-sm text-on-info-container bg-info-container rounded-control px-3 py-2.5" data-testid="fairness-trend">
          {TREND_TEXT[data.trend]} – der gewichtete Anteil war {data.previous.persons.map(p => `${p.name} ${p.share} %`).join(', ')}.
        </p>
      )}

      <Weeks weeks={data.weeks} people={people} asList={asList} />

      {persons.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {persons.map(p => (
            <div key={p.id} className="bg-surface-container-high rounded-control p-3 flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">{p.name}</span>
              <span className="text-sm text-ink-muted">{p.count} erledigt</span>
              <span className="text-sm text-ink-muted">Ø Aufwand {decimal(p.avgWeight)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function FairnessCard() {
  const config = useFairnessConfig()
  const [data, setData] = useState(null)
  const canView = config?.canView === true

  useEffect(() => {
    if (!canView) { setData(null); return }
    let active = true
    const load = () => api.get('/fairness').then(d => { if (active) setData(d) }).catch(() => {})
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { active = false; document.removeEventListener('visibilitychange', onVisible) }
  }, [canView])

  if (!canView || !data) return null

  return (
    <Card className="overflow-hidden mb-4" data-testid="fairness-card">
      <section aria-labelledby="fairness-title">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-outline bg-surface-container-high">
          <span className="text-base" aria-hidden="true">⚖️</span>
          <h2 id="fairness-title" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Fairness · letzte 30 Tage</h2>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <FairnessContent data={data} />
          <p className="text-xs text-ink-faint pt-3 border-t border-outline">
            Zählt tägliche, wöchentliche und monatliche Aufgaben. Einmalige Aufgaben und Abfall-Termine zählen nicht.
          </p>
        </div>
      </section>
    </Card>
  )
}
