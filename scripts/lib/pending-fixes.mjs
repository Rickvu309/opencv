export function expiredPending(
  entries,
  today = new Date().toISOString().slice(0, 10)
) {
  return entries.filter((entry) => entry.expires < today)
}

export function expiredMessage(entries) {
  return entries
    .map(
      (entry) =>
        `${entry.file}: the pending fix for ${entry.issue} expired on ${entry.expires}. Fix the file and delete its entry.`
    )
    .join("\n")
}
