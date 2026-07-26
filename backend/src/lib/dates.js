const TZ = 'Europe/Berlin'

export function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateStringInBerlin(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('sv-SE', { timeZone: TZ })
}

// Addiert (oder subtrahiert, bei negativem n) n Kalendertage zu einem
// YYYY-MM-DD-String. Rein kalendarisch ueber UTC-Mitternacht gerechnet, damit
// das Ergebnis unabhaengig von Server-Zeitzone/DST ist.
export function addDaysToDateString(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function todayString() { return dateStringInBerlin(0) }
export function yesterdayString() { return dateStringInBerlin(-1) }
export function twoDaysAgoString() { return dateStringInBerlin(-2) }

export function currentWeekStart() {
  const today = new Date(dateStringInBerlin(0))
  const day = today.getDay()
  const diff = (day + 6) % 7
  today.setDate(today.getDate() - diff)
  return today.toISOString().slice(0, 10)
}

export function currentMonthStart() {
  return dateStringInBerlin(0).slice(0, 7) + '-01'
}
