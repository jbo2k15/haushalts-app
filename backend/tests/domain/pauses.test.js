import { describe, it, expect } from 'vitest'
import {
  validatePauseRange,
  addDaysToDateString,
  weekEndFromStart,
  monthEndFromStart,
  isPausedOnDay,
  isPeriodFullyPaused,
} from '../../src/domain/pauses.js'

describe('validatePauseRange', () => {
  it('akzeptiert wenn beide Felder leer sind (kein Pausenzeitraum)', () => {
    expect(validatePauseRange(null, null)).toBeNull()
    expect(validatePauseRange(undefined, undefined)).toBeNull()
  })

  it('lehnt ab, wenn nur eines der beiden Felder gesetzt ist', () => {
    expect(validatePauseRange('2026-08-01', null)).toBeTruthy()
    expect(validatePauseRange(null, '2026-08-01')).toBeTruthy()
  })

  it('lehnt ungültiges Datumsformat ab', () => {
    expect(validatePauseRange('01.08.2026', '10.08.2026')).toBeTruthy()
    expect(validatePauseRange('2026-08-01', 'morgen')).toBeTruthy()
  })

  it('lehnt Von nach Bis ab', () => {
    expect(validatePauseRange('2026-08-10', '2026-08-01')).toBeTruthy()
  })

  it('akzeptiert einen gültigen Zeitraum', () => {
    expect(validatePauseRange('2026-08-01', '2026-08-10')).toBeNull()
  })

  it('akzeptiert Von gleich Bis', () => {
    expect(validatePauseRange('2026-08-01', '2026-08-01')).toBeNull()
  })
})

describe('addDaysToDateString', () => {
  it('addiert Tage innerhalb eines Monats', () => {
    expect(addDaysToDateString('2026-08-01', 5)).toBe('2026-08-06')
  })

  it('addiert Tage über einen Monatswechsel hinweg', () => {
    expect(addDaysToDateString('2026-08-30', 3)).toBe('2026-09-02')
  })

  it('addiert Tage über einen Jahreswechsel hinweg', () => {
    expect(addDaysToDateString('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('weekEndFromStart', () => {
  it('liefert den Sonntag zu einem Montags-Wochenbeginn', () => {
    expect(weekEndFromStart('2026-07-13')).toBe('2026-07-19')
  })
})

describe('monthEndFromStart', () => {
  it('liefert den letzten Tag eines 31-Tage-Monats', () => {
    expect(monthEndFromStart('2026-08-01')).toBe('2026-08-31')
  })

  it('liefert den letzten Tag eines 30-Tage-Monats', () => {
    expect(monthEndFromStart('2026-09-01')).toBe('2026-09-30')
  })

  it('liefert den letzten Tag im Februar (Schaltjahr)', () => {
    expect(monthEndFromStart('2028-02-01')).toBe('2028-02-29')
  })

  it('liefert den letzten Tag im Februar (kein Schaltjahr)', () => {
    expect(monthEndFromStart('2026-02-01')).toBe('2026-02-28')
  })
})

describe('isPausedOnDay', () => {
  it('erkennt einen Tag innerhalb des individuellen Zeitraums', () => {
    expect(isPausedOnDay({ pauseFrom: '2026-08-01', pauseTo: '2026-08-10' }, null, '2026-08-05')).toBe(true)
  })

  it('erkennt einen Tag innerhalb des globalen Zeitraums', () => {
    expect(isPausedOnDay(null, { pauseFrom: '2026-08-01', pauseTo: '2026-08-10' }, '2026-08-05')).toBe(true)
  })

  it('gibt false zurück, wenn keiner der beiden Zeiträume den Tag abdeckt', () => {
    expect(isPausedOnDay({ pauseFrom: '2026-08-01', pauseTo: '2026-08-10' }, { pauseFrom: '2026-09-01', pauseTo: '2026-09-10' }, '2026-08-20')).toBe(false)
  })

  it('gibt false zurück, wenn beide Zeiträume null/undefined sind', () => {
    expect(isPausedOnDay(null, undefined, '2026-08-05')).toBe(false)
  })
})

describe('isPeriodFullyPaused', () => {
  it('deckt die Periode vollständig ab, wenn ein einzelner Zeitraum sie komplett umfasst', () => {
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', [{ pauseFrom: '2026-07-01', pauseTo: '2026-07-31' }])).toBe(true)
  })

  it('deckt die Periode ab, wenn die Vereinigung zweier angrenzender Zeiträume sie komplett umfasst', () => {
    const ranges = [
      { pauseFrom: '2026-07-13', pauseTo: '2026-07-15' },
      { pauseFrom: '2026-07-16', pauseTo: '2026-07-19' },
    ]
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', ranges)).toBe(true)
  })

  it('erkennt eine echte Lücke zwischen zwei Zeiträumen als nicht abgedeckt', () => {
    const ranges = [
      { pauseFrom: '2026-07-13', pauseTo: '2026-07-14' },
      { pauseFrom: '2026-07-17', pauseTo: '2026-07-19' },
    ]
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', ranges)).toBe(false)
  })

  it('erkennt einen nur teilweise überlappenden Zeitraum als nicht ausreichend', () => {
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', [{ pauseFrom: '2026-07-13', pauseTo: '2026-07-16' }])).toBe(false)
  })

  it('gibt false zurück für ein leeres Ranges-Array', () => {
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', [])).toBe(false)
  })

  it('gibt false zurück, wenn alle Einträge null/undefined sind', () => {
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', [null, undefined])).toBe(false)
  })

  it('kombiniert individuelle und globale Pause zur vollständigen Abdeckung (Mo-Mi individuell, Do-So global)', () => {
    const ranges = [
      { pauseFrom: '2026-07-13', pauseTo: '2026-07-15' },
      { pauseFrom: '2026-07-16', pauseTo: '2026-07-19' },
    ]
    expect(isPeriodFullyPaused('2026-07-13', '2026-07-19', ranges)).toBe(true)
  })
})
