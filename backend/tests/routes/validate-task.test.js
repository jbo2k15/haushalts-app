import { describe, it, expect } from 'vitest'
import { validateTaskInput } from '../../src/routes/tasks.js'

describe('validateTaskInput', () => {
  const base = { title: 'Test', type: 'daily', priority: 'normal' }

  it('akzeptiert eine gültige tägliche Aufgabe', () => {
    expect(validateTaskInput(base)).toBeNull()
  })

  it('lehnt leeren Titel ab', () => {
    expect(validateTaskInput({ ...base, title: '' })).toBeTruthy()
    expect(validateTaskInput({ ...base, title: '   ' })).toBeTruthy()
  })

  it('lehnt zu langen Titel ab', () => {
    expect(validateTaskInput({ ...base, title: 'x'.repeat(201) })).toBeTruthy()
  })

  it('akzeptiert Titel mit genau 200 Zeichen', () => {
    expect(validateTaskInput({ ...base, title: 'x'.repeat(200) })).toBeNull()
  })

  it('lehnt ungültigen Typ ab', () => {
    expect(validateTaskInput({ ...base, type: 'yearly' })).toBeTruthy()
  })

  it('akzeptiert alle gültigen Typen', () => {
    for (const type of ['daily', 'weekly', 'monthly', 'once']) {
      const input = type === 'once'
        ? { ...base, type, dueDate: '2026-07-01' }
        : { ...base, type }
      expect(validateTaskInput(input)).toBeNull()
    }
  })

  it('lehnt ungültige Priorität ab', () => {
    expect(validateTaskInput({ ...base, priority: 'urgent' })).toBeTruthy()
  })

  it('akzeptiert alle gültigen Prioritäten', () => {
    for (const priority of ['high', 'normal', 'low']) {
      expect(validateTaskInput({ ...base, priority })).toBeNull()
    }
  })

  it('lehnt once-Aufgabe ohne dueDate ab', () => {
    expect(validateTaskInput({ ...base, type: 'once' })).toBeTruthy()
  })

  it('lehnt once-Aufgabe mit ungültigem Datumsformat ab', () => {
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '01.07.2026' })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'once', dueDate: 'morgen' })).toBeTruthy()
  })

  it('akzeptiert once-Aufgabe mit korrektem dueDate', () => {
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-07-01' })).toBeNull()
  })

  it('lehnt formal korrekte, aber unmögliche Kalenderdaten ab', () => {
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-99-99' })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-02-30' })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-13-01' })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-00-10' })).toBeTruthy()
  })

  it('akzeptiert einen gültigen Schalttag', () => {
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2028-02-29' })).toBeNull()
  })

  it('lehnt ungültige Wochentage ab', () => {
    expect(validateTaskInput({ ...base, weekdays: [7] })).toBeTruthy()
    expect(validateTaskInput({ ...base, weekdays: [-1] })).toBeTruthy()
  })

  it('akzeptiert gültige Wochentage 0–6', () => {
    expect(validateTaskInput({ ...base, weekdays: [0, 1, 6] })).toBeNull()
  })

  it('lehnt fixedDayOfMonth außerhalb 1–31 ab', () => {
    expect(validateTaskInput({ ...base, fixedDayOfMonth: 0 })).toBeTruthy()
    expect(validateTaskInput({ ...base, fixedDayOfMonth: 32 })).toBeTruthy()
  })

  it('akzeptiert fixedDayOfMonth 1 und 31', () => {
    expect(validateTaskInput({ ...base, fixedDayOfMonth: 1 })).toBeNull()
    expect(validateTaskInput({ ...base, fixedDayOfMonth: 31 })).toBeNull()
  })

  it('akzeptiert allowMultiple für tägliche und wöchentliche Aufgaben', () => {
    expect(validateTaskInput({ ...base, type: 'daily', allowMultiple: true })).toBeNull()
    expect(validateTaskInput({ ...base, type: 'weekly', allowMultiple: true })).toBeNull()
  })

  it('lehnt allowMultiple für monatliche und einmalige Aufgaben ab', () => {
    expect(validateTaskInput({ ...base, type: 'monthly', allowMultiple: true })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-07-01', allowMultiple: true })).toBeTruthy()
  })

  it('akzeptiert weatherDependent für tägliche Aufgaben', () => {
    expect(validateTaskInput({ ...base, type: 'daily', weatherDependent: true })).toBeNull()
  })

  it('lehnt weatherDependent für nicht-tägliche Aufgaben ab', () => {
    expect(validateTaskInput({ ...base, type: 'weekly', weatherDependent: true })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'monthly', weatherDependent: true })).toBeTruthy()
    expect(validateTaskInput({ ...base, type: 'once', dueDate: '2026-07-01', weatherDependent: true })).toBeTruthy()
  })
})
