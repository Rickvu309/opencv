const DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function coachResetLabel(resetsAt: string, now: Date) {
  const reset = new Date(resetsAt)
  if (Number.isNaN(reset.getTime())) return "later"
  const time = reset.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  })
  const days = Math.round((startOfDay(reset) - startOfDay(now)) / DAY)
  if (days <= 0) return `today at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  const date = reset.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  return `${date} at ${time}`
}
