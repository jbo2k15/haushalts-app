import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import prisma from '../../src/lib/prisma.js'

vi.mock('node-ical', () => ({
  default: { async: { fromURL: vi.fn() } },
}))
vi.mock('../../src/services/duty-feed.js', async (original) => ({
  ...(await original()),
  fetchDutyFeed: vi.fn(),
}))
vi.mock('../../src/services/push.js', () => ({
  sendPushToUser: vi.fn(),
}))

const ical = (await import('node-ical')).default
const feedMock = (await import('../../src/services/duty-feed.js')).fetchDutyFeed
const { syncDutyCalendar } = await import('../../src/services/duty-calendar.js')
const { pushDutyState, retryPendingDutyPushes } = await import('../../src/services/duty-done.js')
const { completeTask } = await import('../../src/domain/tasks.js')

const ENV_KEYS = ['DUTY_ICAL_URL', 'DUTY_ICAL_LABEL', 'DUTY_ICAL_FILTER', 'DUTY_DONE_URL', 'DUTY_DONE_KEY']
const ORIGINAL = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
const DONE_URL = 'https://example.com/huhn/api/dienst-erledigt'
const DAY = '2026-12-01'

const event = (uid, hourUtc, extra = {}) => ({
  type: 'VEVENT', uid, summary: hourUtc < 12 ? 'Futter runterlassen' : 'Futter hochziehen',
  start: new Date(`${DAY}T${String(hourUtc).padStart(2, '0')}:00:00Z`), ...extra,
})
const feed = (extraMorning = {}) => ({ a: event('uid-morgens', 8, extraMorning), b: event('uid-abends', 16) })

let fetchMock
let user
const respond = status => fetchMock.mockResolvedValue({ status, ok: status === 200 })
const morningTask = () => prisma.task.findFirst({ where: { externalUid: 'uid-morgens' } })
const isTicked = async () => !!(await prisma.taskCompletion.findFirst({ where: { taskId: (await morningTask()).id } }))
const tick = async (desired = true) => completeTask((await morningTask()).id, { userId: user.id, userName: user.name, desired })
const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)[1].body)
const waitForSync = state => vi.waitFor(async () => expect((await morningTask()).externalSync).toBe(state))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${DAY}T06:30:00Z`))
  process.env.DUTY_ICAL_URL = 'https://example.com/huhn/kalender.ics?key=geheim123'
  process.env.DUTY_ICAL_LABEL = 'Hühner'
  process.env.DUTY_DONE_URL = DONE_URL
  delete process.env.DUTY_ICAL_FILTER
  delete process.env.DUTY_DONE_KEY
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  respond(200)
  user = await prisma.user.create({ data: { email: `stall-${Math.random()}@test.com`, passwordHash: 'x', name: 'Tobias', approved: true } })
  feedMock.mockResolvedValue(feed())
  await syncDutyCalendar()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const key of ENV_KEYS) {
    if (ORIGINAL[key] === undefined) delete process.env[key]
    else process.env[key] = ORIGINAL[key]
  }
  vi.mocked(ical.async.fromURL).mockReset()
  vi.mocked(feedMock).mockReset()
})

describe('Dienstplan: Rückmeldung an die Quelle', () => {
  it('merkt sich die Termin-UID und meldet Abhaken und Zurücknehmen mit dem Kalender-Schlüssel', async () => {
    expect(fetchMock).not.toHaveBeenCalled()
    await tick()
    await waitForSync('synced')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(DONE_URL)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(lastBody()).toEqual({ key: 'geheim123', uid: 'uid-morgens', erledigt: true })

    await tick(false)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(lastBody()).toEqual({ key: 'geheim123', uid: 'uid-morgens', erledigt: false })
    await waitForSync('synced')
  })

  it('nimmt DUTY_DONE_KEY, wenn gesetzt', async () => {
    process.env.DUTY_DONE_KEY = 'anderer-schluessel'
    await tick()
    await waitForSync('synced')
    expect(lastBody().key).toBe('anderer-schluessel')
  })

  it('bleibt ohne DUTY_DONE_URL still', async () => {
    delete process.env.DUTY_DONE_URL
    await tick()
    expect(await isTicked()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await morningTask()).externalSync).toBeNull()
  })

  it('lässt den Haken bei 503 stehen und holt die Meldung später nach', async () => {
    respond(503)
    await tick()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(await isTicked()).toBe(true)
    expect((await morningTask()).externalSync).toBe('pending')

    fetchMock.mockRejectedValue(new Error('Netz weg'))
    await retryPendingDutyPushes()
    expect((await morningTask()).externalSync).toBe('pending')

    respond(200)
    await retryPendingDutyPushes()
    expect((await morningTask()).externalSync).toBe('synced')
    expect(lastBody()).toMatchObject({ uid: 'uid-morgens', erledigt: true })
  })

  it('gibt bei 404 auf, ohne den Haken anzufassen oder den Schlüssel zu loggen', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    respond(404)
    await tick()
    await waitForSync('rejected')
    expect(await isTicked()).toBe(true)
    await retryPendingDutyPushes()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(error.mock.calls)).not.toContain('geheim123')
  })

  it('meldet nichts für Aufgaben ohne ausstehende Meldung', async () => {
    expect(await pushDutyState((await morningTask()).id)).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Dienstplan: Erledigt-Status aus dem Abo', () => {
  it('übernimmt einen in der Quelle gesetzten Haken, ohne ihn zurückzumelden', async () => {
    feedMock.mockResolvedValue(feed({ 'HUHN-ERLEDIGT': 'TRUE' }))
    await syncDutyCalendar()
    expect(await isTicked()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()

    // In der Quelle wieder entfernt: hier auch
    feedMock.mockResolvedValue(feed({ 'X-HUHN-ERLEDIGT': 'false' }))
    await syncDutyCalendar()
    expect(await isTicked()).toBe(false)
  })

  it('entfernt keinen Haken, der die Quelle nie erreicht hat', async () => {
    delete process.env.DUTY_DONE_URL
    await tick()
    feedMock.mockResolvedValue(feed({ 'HUHN-ERLEDIGT': 'FALSE' }))
    await syncDutyCalendar()
    expect(await isTicked()).toBe(true)
  })

  it('lässt den eigenen Stand gewinnen, solange das Abo hinterherhinken kann', async () => {
    await tick()
    await waitForSync('synced')
    feedMock.mockResolvedValue(feed({ 'HUHN-ERLEDIGT': 'FALSE' }))
    await syncDutyCalendar() // direkt nach der Meldung: Abo noch alt
    expect(await isTicked()).toBe(true)

    vi.setSystemTime(new Date(`${DAY}T07:00:00Z`)) // halbe Stunde später
    await syncDutyCalendar()
    expect(await isTicked()).toBe(false)
  })

  it('ändert nichts, wenn das Feld fehlt', async () => {
    await tick()
    await waitForSync('synced')
    vi.setSystemTime(new Date(`${DAY}T07:00:00Z`))
    await syncDutyCalendar()
    expect(await isTicked()).toBe(true)
  })
})
