function formatDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function calculateTrophies(allLogs, users, { today, curWeekStart, curMonthStart }) {
  const dayTrophies = {}
  const weekTrophies = {}
  const monthTrophies = {}
  users.forEach(u => { dayTrophies[u.id] = 0; weekTrophies[u.id] = 0; monthTrophies[u.id] = 0 })

  const completionsByDay = {}
  for (const log of allLogs) {
    if (log.forDate >= today) continue
    if (!completionsByDay[log.forDate]) completionsByDay[log.forDate] = {}
    completionsByDay[log.forDate][log.completedBy] = (completionsByDay[log.forDate][log.completedBy] || 0) + 1
  }
  for (const counts of Object.values(completionsByDay)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) dayTrophies[winners[0][0]] = (dayTrophies[winners[0][0]] || 0) + 1
  }

  const completionsByWeek = {}
  for (const log of allLogs) {
    const d = new Date(log.forDate)
    const diff = (d.getDay() + 6) % 7
    const mon = new Date(d)
    mon.setDate(d.getDate() - diff)
    const weekKey = formatDateISO(mon)
    if (weekKey >= curWeekStart) continue
    if (!completionsByWeek[weekKey]) completionsByWeek[weekKey] = {}
    completionsByWeek[weekKey][log.completedBy] = (completionsByWeek[weekKey][log.completedBy] || 0) + 1
  }
  for (const counts of Object.values(completionsByWeek)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) weekTrophies[winners[0][0]] = (weekTrophies[winners[0][0]] || 0) + 1
  }

  const completionsByMonth = {}
  for (const log of allLogs) {
    const monthKey = log.forDate.slice(0, 7)
    if (monthKey >= curMonthStart.slice(0, 7)) continue
    if (!completionsByMonth[monthKey]) completionsByMonth[monthKey] = {}
    completionsByMonth[monthKey][log.completedBy] = (completionsByMonth[monthKey][log.completedBy] || 0) + 1
  }
  for (const counts of Object.values(completionsByMonth)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) monthTrophies[winners[0][0]] = (monthTrophies[winners[0][0]] || 0) + 1
  }

  return { dayTrophies, weekTrophies, monthTrophies }
}
