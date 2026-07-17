import prisma from '../lib/prisma.js'
import { broadcastTasksUpdated } from '../lib/sse.js'
import { todayString, dateStringInBerlin } from '../lib/dates.js'

const DEFAULT_RAIN_THRESHOLD_MM = 5

// Reine Summierfunktion, separat exportiert für Unit-Tests ohne fetch-Mock.
// `times`/`precipitation` sind Open-Meteos minutely_15-Arrays (lokale Zeit,
// z.B. "2026-07-19T14:00", nicht kumulativ - je Eintrag der Niederschlag
// dieser 15-Minuten-Periode). Nur Einträge bis "jetzt" zählen, damit reine
// Vorhersage-Werte für spätere Tageszeiten nicht mitgerechnet werden - wir
// wollen den tatsächlich schon gefallenen Regen, nicht die Prognose.
export function sumPrecipitationSoFar(times, precipitation, nowLocalIso) {
  let sum = 0
  for (let i = 0; i < times.length; i++) {
    if (times[i] <= nowLocalIso) sum += precipitation[i] || 0
  }
  return sum
}

function nowLocalBerlinIso() {
  // "2026-07-19T14:05"-Format, passend zu Open-Meteos lokalen (nicht-UTC)
  // Zeitstempeln bei timezone=Europe/Berlin.
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  return fmt.format(new Date()).replace(' ', 'T')
}

// Holt den bereits gefallenen Niederschlag seit Mitternacht (heute, Berlin-
// Zeit) über Open-Meteos minutely_15-Nowcast (DWD ICON-D2, Europa-Abdeckung,
// 15-Minuten-Auflösung, kostenlos, kein API-Key nötig).
export async function fetchRainSoFarTodayMM(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&minutely_15=precipitation&timezone=Europe%2FBerlin&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo antwortete mit Status ${res.status}`)
  const data = await res.json()
  const times = data.minutely_15?.time || []
  const precipitation = data.minutely_15?.precipitation || []
  return sumPrecipitationSoFar(times, precipitation, nowLocalBerlinIso())
}

// Alle 15 Minuten aufgerufen (siehe scheduler.js). Markiert wetterabhängige,
// heute fällige Tagesaufgaben als "vom System erledigt" (status
// 'system-completed' im TaskLog, KEINE TaskCompletion), sobald der
// Niederschlag seit Mitternacht die konfigurierte Schwelle überschreitet.
// Bewusst kein TaskCompletion-Eintrag: die Aufgabe soll nicht in Statistik/
// Trophäen/Fairness einfließen (niemand hat sie tatsächlich erledigt) - das
// ergibt sich automatisch, da jene Auswertungen ausschließlich nach
// status: 'completed' filtern.
export async function checkWeatherDependentTasks() {
  const lat = process.env.WEATHER_LAT
  const lon = process.env.WEATHER_LON
  if (!lat || !lon) return // Feature nicht konfiguriert (kein Standort hinterlegt)

  const threshold = Number(process.env.WEATHER_RAIN_THRESHOLD_MM) || DEFAULT_RAIN_THRESHOLD_MM

  let rainMM
  try {
    rainMM = await fetchRainSoFarTodayMM(lat, lon)
  } catch (err) {
    // Im Zweifel Aufgaben normal anbieten statt fälschlich als erledigt zu markieren.
    console.error('[Weather] Fehler beim Abrufen der Niederschlagsdaten:', err.message)
    return
  }

  if (rainMM < threshold) return

  const today = todayString()
  const todayWeekday = new Date(dateStringInBerlin(0)).getDay()

  const candidates = await prisma.task.findMany({
    where: { type: 'daily', isActive: true, weatherDependent: true },
  })
  const dueToday = candidates.filter(t => {
    const weekdays = t.weekdays ? JSON.parse(t.weekdays) : null
    return !weekdays || weekdays.length === 0 || weekdays.includes(todayWeekday)
  })
  if (dueToday.length === 0) return

  const taskIds = dueToday.map(t => t.id)
  const [completions, systemLogs] = await Promise.all([
    prisma.taskCompletion.findMany({ where: { taskId: { in: taskIds }, forDate: today }, select: { taskId: true } }),
    prisma.taskLog.findMany({ where: { taskId: { in: taskIds }, forDate: today, status: 'system-completed' }, select: { taskId: true } }),
  ])
  const resolvedIds = new Set([...completions.map(c => c.taskId), ...systemLogs.map(l => l.taskId)])
  const toMark = dueToday.filter(t => !resolvedIds.has(t.id))
  if (toMark.length === 0) return

  await prisma.taskLog.createMany({
    data: toMark.map(t => ({ taskId: t.id, taskTitle: t.title, status: 'system-completed', forDate: today })),
  })
  broadcastTasksUpdated()
  console.log(`[Weather] ${toMark.length} wetterabhängige Aufgabe(n) wegen ${rainMM.toFixed(1)}mm Regen seit Mitternacht als erledigt markiert`)
}
