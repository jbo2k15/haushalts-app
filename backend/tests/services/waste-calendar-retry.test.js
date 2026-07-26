import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('node-ical', () => ({
  default: { async: { fromURL: vi.fn() } },
}))

const ical = (await import('node-ical')).default
const { fetchIcalWithRetry } = await import('../../src/services/waste-calendar.js')

afterEach(() => {
  vi.mocked(ical.async.fromURL).mockReset()
})

describe('fetchIcalWithRetry', () => {
  it('wiederholt bei transientem Fehler und liefert das Ergebnis des erfolgreichen Versuchs', async () => {
    ical.async.fromURL
      .mockRejectedValueOnce(new Error('503'))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ e1: { type: 'VEVENT' } })

    const res = await fetchIcalWithRetry('https://example.com/w.ics', { attempts: 3, backoffMs: 1 })

    expect(res).toEqual({ e1: { type: 'VEVENT' } })
    expect(ical.async.fromURL).toHaveBeenCalledTimes(3)
  })

  it('gibt nach Ausschöpfen aller Versuche den letzten Fehler weiter', async () => {
    ical.async.fromURL.mockRejectedValue(new Error('503'))

    await expect(
      fetchIcalWithRetry('https://example.com/w.ics', { attempts: 3, backoffMs: 1 }),
    ).rejects.toThrow('503')
    expect(ical.async.fromURL).toHaveBeenCalledTimes(3)
  })

  it('ruft bei sofortigem Erfolg nur einmal ab (kein unnötiger Retry)', async () => {
    ical.async.fromURL.mockResolvedValueOnce({ ok: true })

    await fetchIcalWithRetry('https://example.com/w.ics', { attempts: 3, backoffMs: 1 })

    expect(ical.async.fromURL).toHaveBeenCalledTimes(1)
  })
})
