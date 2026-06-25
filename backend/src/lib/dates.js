const TZ = 'Europe/Berlin'

export function dateStringInBerlin(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('sv-SE', { timeZone: TZ })
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
