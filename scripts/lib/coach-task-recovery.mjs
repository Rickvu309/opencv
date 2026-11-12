export function detect(source, path = "") {
  if (path === "apps/api/src/coach/task-store.ts") {
    const cancellation = source.slice(
      source.indexOf("export function cancelChatTask(")
    )
    return /if \(!task \|\| \(!taskId && !task\.startKey\.startsWith\("legacy-tab:"\)\)\)/.test(
      cancellation
    )
      ? []
      : [
          {
            message:
              "Chat-scoped Stop must reject tasks without the reserved old-tab start key",
          },
        ]
  }
  if (path === "apps/web/src/lib/coach-task-client.ts") {
    const problems = []
    if (/from ["']zod["']/.test(source))
      problems.push({
        message: "Coach config validation uses the shared domain schema",
      })
    const config = source.slice(
      source.indexOf("export async function getCoachConfig"),
      source.indexOf("export async function startCoachTask")
    )
    if (
      !config.includes("setTimeout(") ||
      !config.includes("controller.abort(")
    )
      problems.push({
        message: "Unknown Coach settings require an abortable fetch deadline",
      })
    return problems
  }
  if (
    ["embedded-worker.ts", "worker.ts", "task-reader.ts"].some(
      (file) => path === `apps/api/src/coach/${file}`
    ) ||
    path === "apps/api/src/chat/store.ts"
  ) {
    if (/coachWorkerEnabledFromEnv|requireTaskRollout/.test(source))
      return [
        {
          message:
            "Rollback gates admissions, never accepted task processing or reads",
        },
      ]
  }
  if (
    path === "apps/api/src/chat/store.ts" &&
    !source.includes("Reload this Chat to follow or stop it.")
  )
    return [
      {
        message:
          "Old tabs retain the working notice after completion hydration",
      },
    ]
  if (path === "apps/api/src/coach/task-start.ts")
    return source.indexOf("if (prior)") >= 0 &&
      source.indexOf("if (prior)") <
        source.indexOf("!coachWorkerEnabledFromEnv")
      ? []
      : [
          {
            message:
              "Rollback rejects new starts after preserving accepted start receipts",
          },
        ]
  if (path === "apps/api/src/coach/turn-compatibility.ts")
    return [
      ...(/receipt\s*\?\s*toolResultFromExecute\(/.test(source)
        ? []
        : [{ message: "Old tabs retain durable receipt reversal metadata" }]),
      ...(/if \(Date.now\(\) >= deadline\) \{[\s\S]*?type: "notice"[\s\S]*?Reload this Chat to follow or stop it.[\s\S]*?type: "message-end"/.test(
        source
      )
        ? []
        : [
            {
              message:
                "Compatibility tails end with a notice event, never reply text, and complete without retry errors",
            },
          ]),
    ]
  if (path === "apps/api/src/config.ts")
    return source.includes(
      'return env.COACH_DURABLE?.trim().toLowerCase() !== "off"'
    )
      ? []
      : [{ message: "Coach defaults to durable with one server kill switch" }]
  if (path === "apps/web/src/features/coach/coach-workspace.tsx")
    return source.includes('store.configuration === "loading"') &&
      source.includes('store.configuration === "error"') &&
      source.includes('role="alert"') &&
      source.includes("store.retry()")
      ? []
      : [
          {
            message:
              "Unknown Coach settings stay visible with loading, error and Retry beside Send",
          },
        ]
  if (path === "apps/web/src/features/coach/use-coach-turn.ts")
    return source.includes("VITE_COACH_TASK_WORKER") ||
      !source.includes("queryFn: getCoachConfig") ||
      !source.includes("const configuration =") ||
      !source.includes('configuration === "ready"')
      ? [{ message: "Coach mode comes from the server at runtime" }]
      : []

  const recovery = source.slice(
    source.indexOf("export async function saveRepliesForUnsavedTurns"),
    source.indexOf("export async function openCoachUsage")
  )
  const problems = []
  if (source.includes("export function coachTaskLifecycleReducer(")) {
    const stop = source.slice(
      source.indexOf('case "stopPressed":'),
      source.indexOf('case "stopSucceeded":')
    )
    if (stop.includes('state.kind === "terminal"'))
      problems.push({
        message: "Terminal Stop Retry must preserve the terminal lifecycle",
      })
  }
  if (source.includes("export function fulfillCoachStop(")) {
    if (!source.includes("existing.listeners.add(onFailure)"))
      problems.push({
        message: "Deduplicated Stop callers must subscribe to failures",
      })
    if (
      !source.includes("OBLIGATION_TIMEOUT_MS") ||
      !source.includes("AbortController")
    )
      problems.push({
        message: "Stop obligations require an abortable overall deadline",
      })
  }
  if (
    path.endsWith("/lib/auth-client.ts") &&
    (!source.includes("disposeCoachStops()") ||
      !source.includes("setCoachStopSession("))
  )
    problems.push({
      message: "Session exit and account change must dispose Coach Stops",
    })
  if (
    path.endsWith("/test/setup.ts") &&
    !source.includes("resetCoachStopsForTests()")
  )
    problems.push({ message: "Shared test teardown must dispose Coach Stops" })
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
      if (!source.includes("requestCoachStop(queryClient, target,"))
        problems.push({
          message:
            "Pending Stop obligations must outlive view detachment in the Stop registry",
        })
      if (!/state\.failedStop[\s\S]*?return stop\(true\)/.test(source))
        problems.push({
          message:
            "Retry must preserve failed cancellation identity and use the Stop obligation",
        })
      if (
        !/\[enabled, discoveredTaskId, options\.chatId, local\.kind\]/.test(
          source
        )
      )
        problems.push({
          message:
            "Reconcile the latest discovered task when the lifecycle can subscribe again",
        })
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
