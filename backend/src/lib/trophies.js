const TZ = 'Europe/Berlin'

function berlinDateOf(loggedAt) {
  return new Date(loggedAt).toLocaleDateString('sv-SE', { timeZone: TZ })
}

function mondayOf(dateStr) {
  const d = new Date(dateStr)
  const diff = (d.getDay() + 6) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - diff)
  return mon.toISOString().slice(0, 10)
}

function awardTrophies(trophyMap, groupedCounts) {
  for (const counts of Object.values(groupedCounts)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) trophyMap[winners[0][0]] = (trophyMap[winners[0][0]] || 0) + 1
  }
}

// Trophies are grouped by the Berlin date of loggedAt (actual completion time),
// NOT by forDate (task period anchor). This prevents weekly/monthly task forDates
// (e.g. "2026-06-01" for a monthly task) from being misclassified into wrong periods.
export function calculateTrophies(allLogs, users, { today, curWeekStart, curMonthStart }) {
  const dayTrophies = {}
  const weekTrophies = {}
  const monthTrophies = {}
  users.forEach(u => { dayTrophies[u.id] = 0; weekTrophies[u.id] = 0; monthTrophies[u.id] = 0 })

  const byDay = {}
  const byWeek = {}
  const byMonth = {}

  for (const log of allLogs) {
    const logDate = berlinDateOf(log.loggedAt)
    const weekKey = mondayOf(logDate)
    const monthKey = logDate.slice(0, 7)
    const userId = log.completedBy

    if (logDate < today) {
      byDay[logDate] ??= {}
      byDay[logDate][userId] = (byDay[logDate][userId] || 0) + 1
    }

    if (weekKey < curWeekStart) {
      byWeek[weekKey] ??= {}
      byWeek[weekKey][userId] = (byWeek[weekKey][userId] || 0) + 1
    }

    if (monthKey < curMonthStart.slice(0, 7)) {
      byMonth[monthKey] ??= {}
      byMonth[monthKey][userId] = (byMonth[monthKey][userId] || 0) + 1
    }
  }

  awardTrophies(dayTrophies, byDay)
  awardTrophies(weekTrophies, byWeek)
  awardTrophies(monthTrophies, byMonth)

  return { dayTrophies, weekTrophies, monthTrophies }
}
