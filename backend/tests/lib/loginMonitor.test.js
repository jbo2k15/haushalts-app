import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { recordFailedLogin, maskEmail, _resetLoginMonitor } from '../../src/lib/loginMonitor.js'

describe('loginMonitor', () => {
  beforeEach(() => { _resetLoginMonitor(); vi.spyOn(console, 'info').mockImplementation(() => {}) })
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

  it('nennt im Alert die häufigsten IPs und maskierten Konten', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < 15; i++) recordFailedLogin({ ip: '203.0.113.7', email: 'tobias@example.com', knownUser: true })
    for (let i = 0; i < 5; i++) recordFailedLogin({ ip: '198.51.100.2', email: 'admin@example.com', knownUser: false })

    expect(warn).toHaveBeenCalledTimes(1)
    const msg = warn.mock.calls[0][0]
    expect(msg).toContain('[SECURITY] Mindestens 20 fehlgeschlagene Login-Versuche')
    expect(msg).toContain('203.0.113.7 (15x)')
    expect(msg).toContain('t***@example.com (15x)')
    expect(msg).not.toContain('tobias@example.com')
  })

  it('protokolliert jeden Fehlversuch mit IP und maskierter E-Mail', () => {
    recordFailedLogin({ ip: '203.0.113.7', email: 'Tobias@Example.com', knownUser: false })
    expect(console.info).toHaveBeenCalledWith('[AUTH] Fehlgeschlagener Login: ip=203.0.113.7 email=t***@example.com (unbekanntes Konto)')
  })

  it('maskiert ungültige Eingaben robust', () => {
    expect(maskEmail(undefined)).toBe('(ungültig)')
    expect(maskEmail('keine-mail')).toBe('(ungültig)')
    expect(maskEmail('@example.com')).toBe('?***@example.com')
  })
})
