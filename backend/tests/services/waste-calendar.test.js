import { describe, it, expect } from 'vitest'
import { subtractOneDay, toDateString } from '../../src/services/waste-calendar.js'

describe('subtractOneDay', () => {
  it('zieht einen Tag ab', () => {
    expect(subtractOneDay('2026-07-15')).toBe('2026-07-14')
  })

  it('überquert Monatsgrenzen korrekt — 1. Juli → 30. Juni', () => {
    expect(subtractOneDay('2026-07-01')).toBe('2026-06-30')
  })

  it('überquert Monatsgrenzen korrekt — 1. März → 28. Februar (kein Schaltjahr)', () => {
    expect(subtractOneDay('2026-03-01')).toBe('2026-02-28')
  })

  it('überquert Monatsgrenzen korrekt — 1. März → 29. Februar (Schaltjahr)', () => {
    expect(subtractOneDay('2028-03-01')).toBe('2028-02-29')
  })

  it('überquert Jahresgrenzen korrekt — 1. Januar → 31. Dezember', () => {
    expect(subtractOneDay('2026-01-01')).toBe('2025-12-31')
  })

  it('gibt immer YYYY-MM-DD Format zurück', () => {
    expect(subtractOneDay('2026-10-01')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('toDateString', () => {
  it('formatiert ein Date-Objekt korrekt', () => {
    expect(toDateString(new Date('2026-07-15T00:00:00Z'))).toMatch(/2026-07-1[45]/)
  })

  it('gibt YYYY-MM-DD Format zurück', () => {
    const result = toDateString(new Date('2026-01-05T00:00:00Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
