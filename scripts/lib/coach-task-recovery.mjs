export function detect(source) {
  const recovery = source.slice(
    source.indexOf("export async function saveRepliesForUnsavedTurns"),
    source.indexOf("export async function openCoachUsage")
  )
  return recovery.includes(".from(coachUsage)") &&
    !/isNull\(coachUsage\.coachTaskId\)/.test(recovery)
    ? [{ message: "Legacy reply recovery must exclude task-backed usage" }]
    : []
}
