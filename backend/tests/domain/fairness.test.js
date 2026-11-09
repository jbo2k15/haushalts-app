import { describe, it, expect } from 'vitest'
import { computeFairness, largestRemainder, isoWeek } from '../../src/domain/fairness.js'
import { addDaysToDateString } from '../../src/lib/dates.js'

const TODAY = '2026-11-09' // Montag, KW 46

const user = (id, name, createdAt = '2026-01-01T12:00:00Z') => ({ id, name, createdAt: new Date(createdAt) })

// n Erledigungen mit gleichem Gewicht, verteilt auf Tage ab `daysAgo` rueckwaerts.
function logs(userId, n, weight, { daysAgo = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    completedBy: userId,
    weight,
    loggedAt: new Date(`${addDaysToDateString(TODAY, -(daysAgo + (i % 20)))}T10:00:00Z`),
  }))
}

describe('largestRemainder', () => {
  it('rundet auf ganze Prozent mit Summe 100', () => {
    expect(largestRemainder([1, 1, 1])).toEqual([34, 33, 33])
    expect(largestRemainder([2, 1])).toEqual([67, 33])
    const r = largestRemainder([0.7, 1.3, 2.9, 5.1])
    expect(r.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('liefert Nullen ohne Daten', () => {
    expect(largestRemainder([0, 0])).toEqual([0, 0])
  })
})

describe('isoWeek', () => {
  it('berechnet ISO-Kalenderwochen', () => {
    expect(isoWeek('2026-11-09')).toBe(46)
    expect(isoWeek('2026-10-12')).toBe(42)
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2027-01-01')).toBe(53)
    expect(isoWeek('2025-12-29')).toBe(1)
  })
})

describe('computeFairness', () => {
  it('gewichtet nach Aufwand', () => {
    const r = computeFairness({
      today: TODAY,
      users: [user('a', 'A'), user('b', 'B')],
      logs: [...logs('a', 3, 3), ...logs('b', 6, 1)],
      vacations: [],
    })
    expect(r.totalPoints).toBe(15)
    expect(r.persons.map(p => [p.id, p.points, p.share])).toEqual([['a', 9, 60], ['b', 6, 40]])
    expect(r.persons[0]).toMatchObject({ count: 3, avgWeight: 3, presentDays: 30, vacationDays: 0 })
    expect(r.window).toEqual({ from: '2026-10-11', to: TODAY })
  })

  it('zeigt nur Personen mit mindestens einem Punkt', () => {
    const r = computeFairness({ today: TODAY, users: [user('a', 'A'), user('b', 'B')], logs: logs('a', 5, 2), vacations: [] })
    expect(r.persons.map(p => p.id)).toEqual(['a'])
    expect(r.persons[0].share).toBe(100)
    expect(r.people.map(p => p.id)).toEqual(['a'])
  })

  it('rechnet Urlaubstage pro Anwesenheitstag heraus', () => {
    // A: 10 Urlaubstage (heute-9 bis heute), 40 Punkte an 20 Tagen; B: 60 Punkte an 30 Tagen
    const r = computeFairness({
      today: TODAY,
      users: [user('a', 'A'), user('b', 'B')],
      logs: [...logs('a', 20, 2, { daysAgo: 10 }), ...logs('b', 30, 2)],
      vacations: [{ userId: 'a', startDate: addDaysToDateString(TODAY, -9), endDate: TODAY }],
    })
    const a = r.persons.find(p => p.id === 'a')
    const b = r.persons.find(p => p.id === 'b')
    expect(a).toMatchObject({ points: 40, presentDays: 20, vacationDays: 10, share: 50 })
    expect(b).toMatchObject({ points: 60, presentDays: 30, vacationDays: 0, share: 50 })
  })

  it('zaehlt eine laufende Urlaubszeit bis einschliesslich heute', () => {
    const r = computeFairness({
      today: TODAY,
      users: [user('a', 'A')],
      logs: logs('a', 5, 2, { daysAgo: 5 }),
      vacations: [{ userId: 'a', startDate: addDaysToDateString(TODAY, -2), endDate: null }],
    })
    expect(r.persons[0].vacationDays).toBe(3)
  })

  it('laesst Personen mit weniger als 7 Anwesenheitstagen aus dem Balken', () => {
    const r = computeFairness({
      today: TODAY,
      users: [user('a', 'A'), user('b', 'B'), user('c', 'C', `${addDaysToDateString(TODAY, -4)}T12:00:00Z`)],
      logs: [...logs('a', 3, 2, { daysAgo: 26 }), ...logs('b', 10, 2), ...logs('c', 2, 2)],
      vacations: [{ userId: 'a', startDate: addDaysToDateString(TODAY, -24), endDate: TODAY }],
    })
    expect(r.persons.map(p => p.id)).toEqual(['b'])
    expect(r.persons[0].share).toBe(100)
    expect(r.mostlyAway).toEqual([
      { id: 'a', name: 'A', reason: 'vacation' },
      { id: 'c', name: 'C', reason: 'new' },
    ])
  })

  it('markiert wenig Daten im Fenster und in Wochen', () => {
    const r = computeFairness({ today: TODAY, users: [user('a', 'A')], logs: logs('a', 2, 2), vacations: [] })
    expect(r.lowData).toBe(true)
    expect(r.weeks).toHaveLength(4)
    expect(r.weeks.map(w => w.label)).toEqual(['KW 42', 'KW 43', 'KW 44', 'KW 45'])
    expect(r.weeks[0]).toMatchObject({ from: '2026-10-12', to: '2026-10-18', totalPoints: 0, lowData: true })
  })

  it('ohne Erledigungen: leerer Zustand', () => {
    const r = computeFairness({ today: TODAY, users: [user('a', 'A')], logs: [], vacations: [] })
    expect(r.totalPoints).toBe(0)
    expect(r.persons).toEqual([])
    expect(r.previous).toBeNull()
    expect(r.trend).toBeNull()
  })

  it('erkennt eine ausgeglichenere Verteilung als im Zeitraum davor', () => {
    const r = computeFairness({
      today: TODAY,
      users: [user('a', 'A'), user('b', 'B')],
      logs: [
        ...logs('a', 10, 2), ...logs('b', 10, 2), // jetzt 50/50
        ...logs('a', 16, 2, { daysAgo: 31 }), ...logs('b', 4, 2, { daysAgo: 31 }), // davor 80/20
      ],
      vacations: [],
    })
    expect(r.previous.persons.map(p => p.share)).toEqual([80, 20])
    expect(r.trend).toBe('more-balanced')
  })

  it('ignoriert Erledigungen unbekannter (z. B. gesperrter) Nutzer', () => {
    const r = computeFairness({ today: TODAY, users: [user('a', 'A')], logs: [...logs('a', 5, 2), ...logs('x', 5, 3)], vacations: [] })
    expect(r.totalPoints).toBe(10)
  })
})
