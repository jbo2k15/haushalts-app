import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { recordFailedLogin, _resetLoginMonitor } from '../../src/lib/loginMonitor.js'

describe('loginMonitor', () => {
  beforeEach(() => { _resetLoginMonitor() })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('warnt erst beim Erreichen der Schwelle (20) und nur einmal (kein Spam)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < 19; i++) recordFailedLogin()
    expect(warn).not.toHaveBeenCalled()
    recordFailedLogin() // 20. Versuch → Alert
    expect(warn).toHaveBeenCalledTimes(1)
    recordFailedLogin() // 21.
    recordFailedLogin() // 22. → kein erneuter Alert
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('meldet nach Ablauf des Zeitfensters erneut', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < 20; i++) recordFailedLogin()
    expect(warn).toHaveBeenCalledTimes(1)
    // Fenster (1h) verstreichen lassen — die alten Versuche fallen aus dem Fenster.
    vi.advanceTimersByTime(61 * 60 * 1000)
    for (let i = 0; i < 20; i++) recordFailedLogin()
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
