export function detect(source) {
  const recovery = source.slice(
    source.indexOf("export async function saveRepliesForUnsavedTurns"),
    source.indexOf("export async function openCoachUsage")
  )
  const problems = []
  if (source.includes("const complete = async")) {
    const completion = source.slice(
      source.indexOf("const complete = async"),
      source.indexOf("if (task.attempt > 1)")
    )
    const continuation = completion.slice(
      completion.indexOf("await pauseTask(lease)")
    )
    if (
      /waiting\s*\|\|=/.test(completion) ||
      (/\bcontinue\b/.test(completion) &&
        !continuation.includes("await runIntent("))
    )
      problems.push({
        message:
          "Skipped task intents need a bounded continuation after proposals resolve",
      })
  }
  if (source.includes("export function finishTask(")) {
    const closure = source.indexOf("await closeTaskApprovals(task.id)")
    const receipts = source.indexOf("registry.turnReceipts(")
    if (closure < 0 || closure > receipts)
      problems.push({
        message: "Close task approvals before collecting terminal receipts",
      })
  }
  if (/"Replay"\s*:\s*"append"/.test(source))
    problems.push({ message: "Replay is model-only until its reader exists" })
  if (
    recovery.includes(".from(coachUsage)") &&
    !/isNull\(coachUsage\.coachTaskId\)/.test(recovery)
  )
    problems.push({
      message: "Legacy reply recovery must exclude task-backed usage",
    })
  return problems
}
