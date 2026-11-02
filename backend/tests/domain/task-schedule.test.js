import { describe, it, expect } from 'vitest'
import { fixedDayInMonth, weeklyTaskVisible, monthlyTaskStatus } from '../../src/domain/tasks.js'
import { daysInMonth } from '../../src/lib/dates.js'

describe('daysInMonth', () => {
  it('kennt kurze Monate und Schaltjahre', () => {
    expect(daysInMonth('2026-11')).toBe(30)
    expect(daysInMonth('2027-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-12')).toBe(31)
  })
})

describe('fixedDayInMonth', () => {
  it('zieht Tage, die es im Monat nicht gibt, auf den Monatsletzten vor', () => {
    expect(fixedDayInMonth('2026-11', 31)).toBe('2026-11-30')
    expect(fixedDayInMonth('2027-02', 30)).toBe('2027-02-28')
    expect(fixedDayInMonth('2028-02', 31)).toBe('2028-02-29')
    expect(fixedDayInMonth('2026-12', 31)).toBe('2026-12-31')
    expect(fixedDayInMonth('2026-11', 5)).toBe('2026-11-05')
  })
})

describe('monthlyTaskStatus mit festem Tag 31', () => {
  const task = { monthlyInterval: 1, nextDueMonth: '2026-11', fixedDayOfMonth: 31 }
  it('ist im November (30 Tage) am 30. sichtbar statt den ganzen Monat unsichtbar (Regression)', () => {
    expect(monthlyTaskStatus(task, { currentMonth: '2026-11', today: '2026-11-30', completedThisMonth: false }).visible).toBe(true)
  })
  it('ist am 29. November noch nicht sichtbar', () => {
    expect(monthlyTaskStatus(task, { currentMonth: '2026-11', today: '2026-11-29', completedThisMonth: false }).visible).toBe(false)
  })
})

describe('weeklyTaskVisible', () => {
  // getDay(): 0 = So, 1 = Mo ... 6 = Sa; Wochen beginnen am Montag.
  it('ohne festen Wochentag immer sichtbar', () => {
    expect(weeklyTaskVisible({ fixedWeekday: null }, 1)).toBe(true)
  })
  it('mit festem Wochentag erst ab diesem Tag der Woche', () => {
    expect(weeklyTaskVisible({ fixedWeekday: 3 }, 2)).toBe(false) // Mi-Aufgabe am Di
    expect(weeklyTaskVisible({ fixedWeekday: 3 }, 3)).toBe(true)
    expect(weeklyTaskVisible({ fixedWeekday: 3 }, 6)).toBe(true)
  })
  it('behandelt Sonntag als letzten Tag der Woche', () => {
    expect(weeklyTaskVisible({ fixedWeekday: 0 }, 6)).toBe(false) // So-Aufgabe am Sa
    expect(weeklyTaskVisible({ fixedWeekday: 0 }, 0)).toBe(true)
    expect(weeklyTaskVisible({ fixedWeekday: 1 }, 0)).toBe(true) // Mo-Aufgabe am So
  })
})
