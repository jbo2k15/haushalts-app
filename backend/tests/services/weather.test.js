import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import prisma from '../../src/lib/prisma.js'

vi.mock('../../src/services/push.js', () => ({ sendPushToUser: vi.fn() }))
const { sendPushToUser } = await import('../../src/services/push.js')
const { sumPrecipitationSoFar, checkWeatherDependentTasks, getWeatherStatus } = await import('../../src/services/weather.js')

const ORIGINAL_LAT = process.env.WEATHER_LAT
const ORIGINAL_LON = process.env.WEATHER_LON
const ORIGINAL_THRESHOLD = process.env.WEATHER_RAIN_THRESHOLD_MM

beforeEach(() => {
  process.env.WEATHER_LAT = '51.5'
  process.env.WEATHER_LON = '7.5'
  process.env.WEATHER_RAIN_THRESHOLD_MM = '5'
})

afterEach(() => {
  vi.restoreAllMocks()
  sendPushToUser.mockClear()
  vi.useRealTimers()
  process.env.WEATHER_LAT = ORIGINAL_LAT
  process.env.WEATHER_LON = ORIGINAL_LON
  process.env.WEATHER_RAIN_THRESHOLD_MM = ORIGINAL_THRESHOLD
})

function mockOpenMeteo(precipitationByTime) {
  const times = Object.keys(precipitationByTime)
  const precipitation = times.map(t => precipitationByTime[t])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ minutely_15: { time: times, precipitation } }),
  }))
}

async function createTask(overrides = {}) {
  return prisma.task.create({
    data: { title: 'Blumen gießen', type: 'daily', priority: 'normal', isActive: true, weatherDependent: true, ...overrides },
  })
}

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: { email: `${Math.random()}@test.com`, passwordHash, name: 'Test User', role: 'user', approved: true, ...overrides },
  })
}

describe('sumPrecipitationSoFar', () => {
  it('summiert nur Einträge bis zum aktuellen Zeitpunkt, nicht die Vorhersage für später', () => {
    const times = ['2026-07-19T06:00', '2026-07-19T06:15', '2026-07-19T18:00']
    const precipitation = [1, 2, 100] // 18 Uhr ist "Vorhersage" für die Zukunft, soll nicht mitzählen
    const sum = sumPrecipitationSoFar(times, precipitation, '2026-07-19T10:00')
    expect(sum).toBe(3)
  })

  it('gibt 0 zurück, wenn keine Einträge bis jetzt vorliegen', () => {
    expect(sumPrecipitationSoFar(['2026-07-19T18:00'], [10], '2026-07-19T06:00')).toBe(0)
  })
})

describe('checkWeatherDependentTasks', () => {
  it('tut nichts, wenn WEATHER_LAT/WEATHER_LON nicht gesetzt sind (Feature deaktiviert)', async () => {
    delete process.env.WEATHER_LAT
    delete process.env.WEATHER_LON
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    await checkWeatherDependentTasks()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('markiert eine fällige wetterabhängige Aufgabe als "vom System erledigt", wenn die Schwelle überschritten ist', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z')) // Sonntag in Berlin-Zeit (UTC+2 im Sommer -> 12:00 lokal)
    mockOpenMeteo({ '2026-07-19T06:00': 3, '2026-07-19T09:00': 4 }) // Summe 7mm > Schwelle 5mm
    const task = await createTask()

    await checkWeatherDependentTasks()

    const log = await prisma.taskLog.findFirst({ where: { taskId: task.id, status: 'system-completed' } })
    expect(log).toBeTruthy()
    const completion = await prisma.taskCompletion.findFirst({ where: { taskId: task.id } })
    expect(completion).toBeNull() // bewusst keine TaskCompletion - fließt nicht in Statistik/Trophäen ein
  })

  it('markiert nichts, wenn der Niederschlag unter der Schwelle liegt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 1 }) // 1mm < Schwelle 5mm
    const task = await createTask()

    await checkWeatherDependentTasks()

    const log = await prisma.taskLog.findFirst({ where: { taskId: task.id, status: 'system-completed' } })
    expect(log).toBeNull()
  })

  it('erstellt keinen doppelten Log-Eintrag bei wiederholtem Aufruf am selben Tag', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 10 })
    const task = await createTask()

    await checkWeatherDependentTasks()
    await checkWeatherDependentTasks()

    const logs = await prisma.taskLog.findMany({ where: { taskId: task.id, status: 'system-completed' } })
    expect(logs).toHaveLength(1)
  })

  it('ignoriert eine bereits vom Nutzer erledigte wetterabhängige Aufgabe', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 10 })
    const task = await createTask()
    await prisma.taskCompletion.create({ data: { taskId: task.id, forDate: '2026-07-19' } })

    await checkWeatherDependentTasks()

    const log = await prisma.taskLog.findFirst({ where: { taskId: task.id, status: 'system-completed' } })
    expect(log).toBeNull()
  })

  it('markiert nicht-wetterabhängige Aufgaben nie', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 10 })
    const task = await createTask({ weatherDependent: false })

    await checkWeatherDependentTasks()

    const log = await prisma.taskLog.findFirst({ where: { taskId: task.id } })
    expect(log).toBeNull()
  })

  it('bietet Aufgaben im Zweifel normal an, wenn Open-Meteo nicht erreichbar ist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const task = await createTask()

    await expect(checkWeatherDependentTasks()).resolves.not.toThrow()

    const log = await prisma.taskLog.findFirst({ where: { taskId: task.id } })
    expect(log).toBeNull()
  })

  it('speichert den Wetter-Status auch, wenn die Schwelle nicht überschritten wird', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 1 }) // unter Schwelle

    await checkWeatherDependentTasks()

    const status = await prisma.weatherStatus.findUnique({ where: { id: 'singleton' } })
    expect(status).toBeTruthy()
    expect(status.rainMM).toBe(1)
  })

  it('aktualisiert den Wetter-Status bei jedem erfolgreichen Check (letzter Wert gewinnt)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 1 })
    await checkWeatherDependentTasks()

    mockOpenMeteo({ '2026-07-19T06:00': 2 })
    await checkWeatherDependentTasks()

    const status = await prisma.weatherStatus.findUnique({ where: { id: 'singleton' } })
    expect(status.rainMM).toBe(2)
  })

  it('speichert den Wetter-Status NICHT, wenn Open-Meteo nicht erreichbar ist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await checkWeatherDependentTasks()

    const status = await prisma.weatherStatus.findUnique({ where: { id: 'singleton' } })
    expect(status).toBeNull()
  })

  it('benachrichtigt nur Nutzer mit aktivierter Wetter-Benachrichtigung, die nicht im Urlaubsmodus sind', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 10 })
    await createTask()
    const optedIn = await createUser({ notifyOnWeatherSkip: true })
    const optedOut = await createUser({ notifyOnWeatherSkip: false })
    const onVacation = await createUser({ notifyOnWeatherSkip: true, vacationMode: true })

    await checkWeatherDependentTasks()

    const notifiedIds = sendPushToUser.mock.calls.map(call => call[0])
    expect(notifiedIds).toContain(optedIn.id)
    expect(notifiedIds).not.toContain(optedOut.id)
    expect(notifiedIds).not.toContain(onVacation.id)
  })

  it('benachrichtigt niemanden, wenn keine Aufgabe markiert wurde', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 1 }) // unter Schwelle
    await createUser({ notifyOnWeatherSkip: true })

    await checkWeatherDependentTasks()

    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})

describe('getWeatherStatus', () => {
  it('meldet configured:false ohne WEATHER_LAT/WEATHER_LON', async () => {
    delete process.env.WEATHER_LAT
    delete process.env.WEATHER_LON
    const status = await getWeatherStatus()
    expect(status.configured).toBe(false)
  })

  it('gibt die konfigurierte Schwelle und null für rainMM/checkedAt zurück, wenn noch nie geprüft wurde', async () => {
    const status = await getWeatherStatus()
    expect(status.configured).toBe(true)
    expect(status.thresholdMM).toBe(5)
    expect(status.rainMM).toBeNull()
    expect(status.checkedAt).toBeNull()
  })

  it('gibt den zuletzt gespeicherten Regenwert und Zeitpunkt zurück', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
    mockOpenMeteo({ '2026-07-19T06:00': 2 })
    await checkWeatherDependentTasks()

    const status = await getWeatherStatus()
    expect(status.rainMM).toBe(2)
    expect(status.checkedAt).toBeTruthy()
  })

  it('nutzt den Default-Schwellwert 5mm, wenn WEATHER_RAIN_THRESHOLD_MM nicht gesetzt ist', async () => {
    delete process.env.WEATHER_RAIN_THRESHOLD_MM
    const status = await getWeatherStatus()
    expect(status.thresholdMM).toBe(5)
  })
})
