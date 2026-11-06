export function detect(source, path = "") {
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
  if (
    (path.includes("/registry/") || path.endsWith("/chat/commands.ts")) &&
    /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']\.\.\/coach\/index\.js["']/.test(
      source
    )
  )
    problems.push({
      message:
        "Load Coach handlers only when invoked to avoid the Chat import cycle",
    })
  if (
    /if\s*\(\s*!entry\s*\)\s*throw new Error\("Unknown model tool"\)/.test(
      source
    )
  )
    problems.push({
      message:
        "Unknown tools must preserve legacy streaming without a durable boundary",
    })
  if (source.includes("export function useCoachTask(")) {
    if (
      /"coach\.stop",\s*\{[^}]*\}/.test(source) &&
      [...source.matchAll(/"coach\.stop",\s*\{([^}]*)\}/g)].some(
        (match) => !/\btaskId\b/.test(match[1])
      )
    )
      problems.push({
        message:
          "Durable Stop must target the recovered task id, never current Chat work",
      })
    if (source.includes("coachTaskLifecycleReducer")) {
      if (
        !source.includes("if (!matches()) return") ||
        !source.includes("state.generation === generation") ||
        !source.includes("state.request.startKey === startKey")
      )
        problems.push({
          message:
            "Start continuations must match generation and start key before Stop",
        })
      return problems
    }
    const stop = source.slice(
      source.indexOf("    stop: () => {"),
      source.indexOf("    undo:")
    )
    if (!stop.includes("request.stopRequested = true"))
      problems.push({
        message: "Latch Stop on the pending start before a Chat exists",
      })
    const cleanup = source.slice(
      source.indexOf("      } finally {"),
      source.indexOf("    return true")
    )
    const detach = source.slice(source.indexOf("    cancelInFlight: () => {"))
    if (
      !detach.includes("starting.current = false") ||
      !/if \(current === generation.current\) \{\s*starting.current = false/.test(
        cleanup
      )
    )
      problems.push({
        message: "Release detached starts and guard lock cleanup by generation",
      })
  }
  return problems
}
