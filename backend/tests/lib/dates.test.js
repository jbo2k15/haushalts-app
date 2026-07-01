import { describe, it, expect, vi, afterEach } from 'vitest'
import { currentWeekStart, currentMonthStart, todayString } from '../../src/lib/dates.js'

afterEach(() => vi.useRealTimers())

function mockDate(isoString) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoString))
}

describe('todayString', () => {
  it('gibt das heutige Datum zurück', () => {
    mockDate('2026-07-01T10:00:00Z')
    expect(todayString()).toBe('2026-07-01')
  })
})

describe('currentWeekStart', () => {
  it('gibt Montag der laufenden Woche zurück — Mittwoch', () => {
    mockDate('2026-07-01T10:00:00Z') // Mittwoch
    expect(currentWeekStart()).toBe('2026-06-29')
  })

  it('gibt sich selbst zurück wenn heute Montag ist', () => {
    mockDate('2026-06-29T10:00:00Z') // Montag
    expect(currentWeekStart()).toBe('2026-06-29')
  })

  it('gibt Montag zurück wenn heute Sonntag ist', () => {
    mockDate('2026-07-05T10:00:00Z') // Sonntag
    expect(currentWeekStart()).toBe('2026-06-29')
  })

  it('überquert Monatsgrenzen korrekt', () => {
    mockDate('2026-07-02T10:00:00Z') // Donnerstag
    expect(currentWeekStart()).toBe('2026-06-29')
  })

  it('überquert Jahresgrenzen korrekt', () => {
    mockDate('2026-01-01T10:00:00Z') // Donnerstag
    expect(currentWeekStart()).toBe('2025-12-29')
  })
})

describe('currentMonthStart', () => {
  it('gibt den ersten des aktuellen Monats zurück', () => {
    mockDate('2026-07-15T10:00:00Z')
    expect(currentMonthStart()).toBe('2026-07-01')
  })

  it('gibt den ersten Januar zurück wenn heute der erste ist', () => {
    mockDate('2026-01-01T10:00:00Z')
    expect(currentMonthStart()).toBe('2026-01-01')
  })
})
