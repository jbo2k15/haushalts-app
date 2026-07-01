import { describe, it, expect } from 'vitest'
import { calculateTrophies } from '../../src/lib/trophies.js'

const TODAY = '2026-07-02'
const CUR_WEEK = '2026-06-29' // Montag dieser Woche
const CUR_MONTH = '2026-07-01'

function log(userId, isoDate) {
  return { completedBy: userId, loggedAt: new Date(`${isoDate}T10:00:00Z`) }
}

const users = [
  { id: 'u1' },
  { id: 'u2' },
]

describe('calculateTrophies', () => {
  it('vergibt keine Trophäen wenn keine Logs vorhanden', () => {
    const result = calculateTrophies([], users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.dayTrophies).toEqual({ u1: 0, u2: 0 })
    expect(result.weekTrophies).toEqual({ u1: 0, u2: 0 })
    expect(result.monthTrophies).toEqual({ u1: 0, u2: 0 })
  })

  it('vergibt Tages-Trophäe an den Nutzer mit mehr Erledigungen am Vortag', () => {
    const logs = [
      log('u1', '2026-07-01'), // gestern
      log('u1', '2026-07-01'),
      log('u2', '2026-07-01'),
    ]
    const result = calculateTrophies(logs, users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.dayTrophies.u1).toBe(1)
    expect(result.dayTrophies.u2).toBe(0)
  })

  it('vergibt keine Trophäe bei Gleichstand', () => {
    const logs = [
      log('u1', '2026-07-01'),
      log('u2', '2026-07-01'),
    ]
    const result = calculateTrophies(logs, users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.dayTrophies.u1).toBe(0)
    expect(result.dayTrophies.u2).toBe(0)
  })

  it('ignoriert Logs vom heutigen Tag bei Tages-Trophäen', () => {
    const logs = [log('u1', TODAY)]
    const result = calculateTrophies(logs, users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.dayTrophies.u1).toBe(0)
  })

  it('vergibt Wochen-Trophäen für abgeschlossene Vorwochen', () => {
    // Vorwoche: 22.–28. Juni
    const logs = [
      log('u1', '2026-06-22'),
      log('u1', '2026-06-23'),
      log('u2', '2026-06-22'),
    ]
    const result = calculateTrophies(logs, users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.weekTrophies.u1).toBe(1)
    expect(result.weekTrophies.u2).toBe(0)
  })

  it('ignoriert Logs der laufenden Woche bei Wochen-Trophäen', () => {
    const logs = [log('u1', '2026-06-29')] // laufende Woche
    const result = calculateTrophies(logs, users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.weekTrophies.u1).toBe(0)
  })

  it('vergibt Monats-Trophäen über mehrere Monate korrekt', () => {
    const logs = [
      log('u1', '2026-06-01'), // letzter Monat — u1 gewinnt
      log('u1', '2026-06-02'),
      log('u2', '2026-06-01'),
      log('u1', '2026-05-15'), // vorletzter Monat — Gleichstand
      log('u2', '2026-05-15'),
    ]
    const result = calculateTrophies(logs, users, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    expect(result.monthTrophies.u1).toBe(1)
    expect(result.monthTrophies.u2).toBe(0)
  })

  it('vergibt Trophäe auch bei nur einem Nutzer', () => {
    const singleUser = [{ id: 'u1' }]
    const logs = [log('u1', '2026-07-01')]
    const result = calculateTrophies(logs, singleUser, { today: TODAY, curWeekStart: CUR_WEEK, curMonthStart: CUR_MONTH })
    // Einziger Teilnehmer gewinnt automatisch (winners.length === 1)
    expect(result.dayTrophies.u1).toBe(1)
  })
})
