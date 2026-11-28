import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fetchDutyFeed, resetDutyFeedState, retryAfterMs } from '../../src/services/duty-feed.js'

// Abruf des Dienstplan-Kalenders: echter node-ical-Parser, nachgestellte
// HTTP-Antworten.
const ICS = readFileSync(fileURLToPath(new URL('../fixtures/dienstplan-beispiel.ics', import.meta.url)), 'utf8')
const URL_WITH_KEY = 'https://example.com/huhn/kalender.ics?key=geheim123'
const FAST = { backoffMs: 1 }

const response = (status, headers = {}, body = ICS) => ({
  status, headers: { get: name => headers[name.toLowerCase()] ?? null }, text: async () => body,
})
const vevents = events => Object.values(events).filter(e => e.type === 'VEVENT')

let fetchMock
let log
let warn

beforeEach(() => {
  resetDutyFeedState()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchDutyFeed', () => {
  it('lädt und liest den Kalender und protokolliert den Abruf ohne Adresse', async () => {
    fetchMock.mockResolvedValue(response(200))
    const events = await fetchDutyFeed(URL_WITH_KEY)
    expect(vevents(events)).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(fetchMock.mock.calls[0][1].headers['If-None-Match']).toBeUndefined()
    const text = JSON.stringify(log.mock.calls)
    expect(text).toContain('HTTP 200, 3 Termine')
    expect(text).not.toContain('geheim123')
    expect(text).not.toContain('example.com')
  })

  it('schickt das gemerkte ETag mit und nimmt bei 304 den letzten Stand', async () => {
    fetchMock.mockResolvedValue(response(200, { etag: '"v1"' }))
    const first = await fetchDutyFeed(URL_WITH_KEY)

    fetchMock.mockResolvedValue(response(304, {}, ''))
    const second = await fetchDutyFeed(URL_WITH_KEY)
    expect(fetchMock.mock.calls[1][1].headers['If-None-Match']).toBe('"v1"')
    expect(second).toBe(first)
    expect(JSON.stringify(log.mock.calls)).toContain('HTTP 304, unverändert')
  })

  it('nutzt Last-Modified, wenn kein ETag kommt', async () => {
    fetchMock.mockResolvedValue(response(200, { 'last-modified': 'Sat, 28 Nov 2026 08:00:00 GMT' }))
    await fetchDutyFeed(URL_WITH_KEY)
    await fetchDutyFeed(URL_WITH_KEY)
    expect(fetchMock.mock.calls[1][1].headers['If-Modified-Since']).toBe('Sat, 28 Nov 2026 08:00:00 GMT')
  })

  it('wiederholt bei 429 nicht und setzt die Abrufe für die verlangte Zeit aus', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-01T06:00:00Z'))
    fetchMock.mockResolvedValue(response(429, { 'retry-after': '7200' }))
    await expect(fetchDutyFeed(URL_WITH_KEY, FAST)).rejects.toThrow('HTTP 429')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValue(response(200))
    vi.setSystemTime(new Date('2026-12-01T07:00:00Z'))
    expect(await fetchDutyFeed(URL_WITH_KEY, FAST)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-12-01T08:00:01Z'))
    expect(vevents(await fetchDutyFeed(URL_WITH_KEY, FAST))).toHaveLength(3)
  })

  it('hält auch bei 503 mit Retry-After Pause', async () => {
    fetchMock.mockResolvedValue(response(503, { 'retry-after': '600' }))
    await expect(fetchDutyFeed(URL_WITH_KEY, FAST)).rejects.toThrow('HTTP 503')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await fetchDutyFeed(URL_WITH_KEY, FAST)).toBeNull()
  })

  it('wiederholt bei 503 ohne Retry-After und gibt dann auf, ohne den Link zu nennen', async () => {
    fetchMock.mockResolvedValue(response(503))
    const error = await fetchDutyFeed(URL_WITH_KEY, FAST).catch(e => e)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(error.message).toBe('HTTP 503')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('geheim123')
  })

  it('wiederholt bei 404 nicht', async () => {
    fetchMock.mockResolvedValue(response(404))
    await expect(fetchDutyFeed(URL_WITH_KEY, FAST)).rejects.toThrow('HTTP 404')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('bricht eine hängende Anfrage beim Timeout wirklich ab', async () => {
    const signals = []
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signals.push(signal)
      signal.addEventListener('abort', () => reject(signal.reason))
    }))
    await expect(fetchDutyFeed(URL_WITH_KEY, { attempts: 2, timeoutMs: 30, backoffMs: 1 })).rejects.toThrow('Timeout')
    expect(signals).toHaveLength(2)
    expect(signals.every(s => s.aborted)).toBe(true)
  })

  it('verschweigt den Link auch bei Netzfehlern', async () => {
    fetchMock.mockRejectedValue(new Error(`getaddrinfo ENOTFOUND ${URL_WITH_KEY}`))
    const error = await fetchDutyFeed(URL_WITH_KEY, FAST).catch(e => e)
    expect(error.message).toBe('Verbindung fehlgeschlagen')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('geheim123')
  })
})

describe('retryAfterMs', () => {
  const res = value => ({ headers: { get: () => value } })
  it('liest Sekunden und HTTP-Datum, begrenzt auf 24 Stunden', () => {
    const now = Date.parse('2026-12-01T06:00:00Z')
    expect(retryAfterMs(res('120'), now)).toBe(120000)
    expect(retryAfterMs(res('Tue, 01 Dec 2026 06:30:00 GMT'), now)).toBe(30 * 60000)
    expect(retryAfterMs(res('999999'), now)).toBe(24 * 3600000)
    expect(retryAfterMs(res('Unsinn'), now)).toBeNull()
    expect(retryAfterMs(res(null), now)).toBeNull()
    expect(retryAfterMs({}, now)).toBeNull()
  })
})
