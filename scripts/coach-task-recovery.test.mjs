import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/coach-task-recovery.mjs"

test("Coach config validation uses the declared domain dependency", () => {
  const path = "apps/web/src/lib/coach-task-client.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  const mistake = `import { z } from "zod"\n${clean}`
  assert.equal(detect(mistake, path).length, 1)
  assert.deepEqual(detect(clean, path), [])
})

test("old tabs retain durable receipt reversal metadata", () => {
  const path = "apps/api/src/coach/turn-compatibility.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  const mistake = clean.replace("? toolResultFromExecute(", "? wireResult(")
  assert.equal(detect(mistake, path).length, 1)
  assert.deepEqual(detect(clean, path), [])
})

const mistake =
  "export async function saveRepliesForUnsavedTurns() { query.from(coachUsage).where(isNull(coachUsage.messageId)) } export async function openCoachUsage() {}"
const clean = mistake.replace(
  "isNull(coachUsage.messageId)",
  "isNull(coachUsage.messageId), isNull(coachUsage.coachTaskId)"
)

test("legacy recovery excludes durable tasks that own their canonical reply", () => {
  assert.equal(detect(mistake).length, 1)
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(
    detect(
      readFileSync(
        new URL("../apps/api/src/coach/usage-store.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})

const workerMistake =
  "const complete = async (saved) => { for (const intent of intents) { if (waiting) continue; await runIntent(lease, intent, registry); waiting ||= proposed } if (await pauseTask(lease)) throw paused; const results = restored.intents }; if (task.attempt > 1) {}"
const workerClean = workerMistake
  .replace("waiting ||= proposed", "waiting = proposed")
  .replace(
    "const results =",
    "for (const intent of deferred) await runIntent(lease, intent, registry); const results ="
  )
const finishMistake =
  "export function finishTask(lease) { registry.turnReceipts(owner, usage); finalize(lease) }"
const finishClean = finishMistake.replace(
  "registry.turnReceipts",
  "await closeTaskApprovals(task.id); registry.turnReceipts"
)

for (const [name, path, mistake, clean] of [
  [
    "resolved proposals cannot strand automatic intents",
    "apps/api/src/coach/worker.ts",
    workerMistake,
    workerClean,
  ],
  [
    "terminal receipts cannot retain closed approvals",
    "apps/api/src/coach/worker-store.ts",
    finishMistake,
    finishClean,
  ],
  [
    "replay cannot claim the event writer as its reader",
    "apps/api/src/coach/CoachTask.tla.json",
    '{"Replay":"append"}',
    '{"Replay":"readTaskEvents"}',
  ],
]) {
  test(name, () => {
    assert.equal(detect(mistake).length, 1)
    assert.deepEqual(detect(clean), [])
    assert.deepEqual(
      detect(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")),
      []
    )
  })
}

const approvalImportMistake =
  'import { resolveTaskApproval } from "../coach/index.js"'
const approvalImportClean =
  'const { resolveTaskApproval } = await import("../coach/index.js")'
const unknownToolMistake = 'if (!entry) throw new Error("Unknown model tool")'
const unknownToolClean =
  'if (!entry && input.boundary) throw new Error("Unknown model tool")'

for (const [name, path, mistake, clean] of [
  [
    "Chat stop avoids eagerly loading Coach during Chat initialization",
    "apps/api/src/chat/commands.ts",
    approvalImportMistake.replace("resolveTaskApproval", "cancelChatTask"),
    approvalImportClean.replaceAll("resolveTaskApproval", "cancelChatTask"),
  ],
  [
    "approval resolution avoids eagerly loading Coach during Chat initialization",
    "apps/api/src/registry/registry.ts",
    approvalImportMistake,
    approvalImportClean,
  ],
  [
    "proposal locking avoids eagerly loading Coach during Chat initialization",
    "apps/api/src/registry/proposals.ts",
    approvalImportMistake.replace("resolveTaskApproval", "lockTaskApproval"),
    approvalImportClean.replaceAll("resolveTaskApproval", "lockTaskApproval"),
  ],
  [
    "unknown tool rejection requires a durable boundary",
    "apps/api/src/coach/anthropic-runtime.ts",
    unknownToolMistake,
    unknownToolClean,
  ],
]) {
  test(name, () => {
    assert.equal(detect(mistake, path).length, 1)
    assert.deepEqual(detect(clean, path), [])
    assert.deepEqual(
      detect(
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
        path
      ),
      []
    )
  })
}

const clientClean = `export function useCoachTask() {
      } finally {
        if (current === generation.current) {
          starting.current = false
        }
      }
    return true
    stop: () => {
      request.stopRequested = true
    },
    undo:
    cancelInFlight: () => {
      starting.current = false
    }
}`
for (const [name, mistake] of [
  [
    "Stop is latched before Chat creation settles",
    clientClean.replace("request.stopRequested = true", ""),
  ],
  [
    "detach releases its lock",
    clientClean.replace(
      "    cancelInFlight: () => {\n      starting.current = false",
      "    cancelInFlight: () => {"
    ),
  ],
  [
    "stale cleanup cannot release a newer start",
    clientClean.replace("if (current === generation.current) {", "{"),
  ],
]) {
  test(name, () => {
    assert.equal(detect(mistake).length, 1)
    assert.deepEqual(detect(clientClean), [])
    assert.deepEqual(
      detect(
        readFileSync(
          new URL(
            "../apps/web/src/features/coach/use-coach-task.ts",
            import.meta.url
          ),
          "utf8"
        )
      ),
      []
    )
  })
}

const machineClean =
  'export function useCoachTask() { coachTaskLifecycleReducer; if (!matches()) return; state.generation === generation; state.request.startKey === startKey; runContractCommand(client, "coach.stop", { chatId, taskId }); requestCoachStop(queryClient, target, onFailure); if (state.failedStop) return stop(true); [enabled, discoveredTaskId, options.chatId, local.kind] }'

for (const [name, clean, mistake] of [
  [
    "durable Stop names the exact task",
    machineClean,
    machineClean.replace("{ chatId, taskId }", "{ chatId }"),
  ],
  [
    "machine continuations match both generation and start key",
    machineClean,
    machineClean.replace("state.request.startKey === startKey", "true"),
  ],
]) {
  test(name, () => {
    assert.ok(detect(mistake).length > 0)
    assert.deepEqual(detect(clean), [])
    assert.deepEqual(
      detect(
        readFileSync(
          new URL(
            "../apps/web/src/features/coach/use-coach-task.ts",
            import.meta.url
          ),
          "utf8"
        )
      ),
      []
    )
  })
}

const stopRegistryGuards = [
  [
    "Stop survives detach outside the view",
    "requestCoachStop(queryClient, target,",
    "stopTask(",
  ],
  ["Retry retains the failed Stop", "state.failedStop", "state.error"],
  [
    "discovery is reconsidered after recovery",
    "options.chatId, local.kind]",
    "options.chatId]",
  ],
]
for (const [name, required, mistake] of stopRegistryGuards) {
  test(name, () => {
    const clean = readFileSync(
      new URL(
        "../apps/web/src/features/coach/use-coach-task.ts",
        import.meta.url
      ),
      "utf8"
    )
    assert.deepEqual(detect(clean), [])
    assert.ok(detect(clean.replaceAll(required, mistake)).length > 0)
    const historic = execFileSync(
      "git",
      ["show", "cf31f543:apps/web/src/features/coach/use-coach-task.ts"],
      { encoding: "utf8" }
    )
    assert.ok(
      detect(historic).some(
        (problem) =>
          problem.message ===
          detect(clean.replaceAll(required, mistake))[0].message
      )
    )
  })
}

for (const [name, path, historicPath, required] of [
  [
    "terminal Retry preserves Send admission",
    "apps/web/src/features/coach/coach-task-lifecycle.ts",
    "apps/web/src/features/coach/coach-task-lifecycle.ts",
    'return state.kind === "running"',
  ],
  [
    "deduplicated failures reach every view",
    "apps/web/src/lib/coach-stop-registry.ts",
    "apps/web/src/features/coach/coach-stop-obligations.ts",
    "existing.listeners.add(onFailure)",
  ],
  [
    "pending I/O has an abortable deadline",
    "apps/web/src/lib/coach-stop-registry.ts",
    "apps/web/src/features/coach/coach-stop-obligations.ts",
    "OBLIGATION_TIMEOUT_MS",
  ],
  [
    "session disposal owns Stop cleanup",
    "apps/web/src/lib/auth-client.ts",
    "apps/web/src/lib/auth-client.ts",
    "disposeCoachStops()",
  ],
  [
    "test teardown owns Stop cleanup",
    "apps/web/src/test/setup.ts",
    "apps/web/src/test/setup.ts",
    "resetCoachStopsForTests()",
  ],
]) {
  test(name, () => {
    const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    const mistake =
      name === "terminal Retry preserves Send admission"
        ? clean.replace(
            required,
            'return state.kind === "terminal" || state.kind === "running"'
          )
        : clean.replaceAll(required, "missing")
    assert.deepEqual(detect(clean, path), [])
    const failures = detect(mistake, path)
    assert.ok(failures.length > 0)
    const historic = execFileSync("git", ["show", `f62efbf1:${historicPath}`], {
      encoding: "utf8",
    })
    assert.ok(
      detect(historic, historicPath).some(
        (problem) => problem.message === failures[0].message
      )
    )
  })
}

for (const [path, mistake, clean] of [
  [
    "apps/api/src/config.ts",
    'return env.COACH_TASK_WORKER === "internal"',
    'return env.COACH_DURABLE?.trim().toLowerCase() !== "off"',
  ],
  [
    "apps/web/src/features/coach/use-coach-turn.ts",
    'const durableEnabled = import.meta.env.VITE_COACH_TASK_WORKER === "internal"',
    'queryFn: getCoachConfig; const configuration = configuration === "ready"',
  ],
]) {
  test(`durable default deployment: ${path}`, () => {
    assert.equal(detect(mistake, path).length, 1)
    assert.deepEqual(detect(clean, path), [])
    assert.deepEqual(
      detect(
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
        path
      ),
      []
    )
    const historic = execFileSync("git", ["show", `67ef657:${path}`], {
      encoding: "utf8",
    })
    assert.equal(detect(historic, path).length, 1)
  })
}

for (const path of [
  "apps/api/src/coach/embedded-worker.ts",
  "apps/api/src/coach/worker.ts",
  "apps/api/src/coach/task-reader.ts",
  "apps/api/src/coach/task-start.ts",
  "apps/api/src/chat/store.ts",
  "apps/api/src/coach/turn-compatibility.ts",
  "apps/web/src/lib/coach-task-client.ts",
  "apps/web/src/features/coach/use-coach-turn.ts",
  "apps/web/src/features/coach/coach-workspace.tsx",
]) {
  test(`rollback and compatibility guards reject 92b6581a: ${path}`, () => {
    const historic = execFileSync("git", ["show", `92b6581a:${path}`], {
      encoding: "utf8",
    })
    const current = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.ok(detect(historic, path).length > 0)
    assert.deepEqual(detect(current, path), [])
  })
}

for (const [path, required] of [
  ["apps/api/src/chat/store.ts", "Reload this Chat to follow or stop it."],
  [
    "apps/api/src/coach/turn-compatibility.ts",
    "Reload this Chat to follow or stop it.",
  ],
]) {
  test(`old tabs retain a visible working notice: ${path}`, () => {
    const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.deepEqual(detect(clean, path), [])
    assert.ok(detect(clean.replaceAll(required, "missing"), path).length > 0)
    const historic = execFileSync("git", ["show", `92b6581a:${path}`], {
      encoding: "utf8",
    })
    assert.ok(detect(historic, path).length > 0)
  })
}

test("the still-working notice never travels as reply text", () => {
  const path = "apps/api/src/coach/turn-compatibility.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.deepEqual(detect(clean, path), [])
  assert.ok(
    detect(clean.replace('type: "notice"', 'type: "text-delta"'), path).length >
      0
  )
  const main = execFileSync("git", ["show", `2a4ea761:${path}`], {
    encoding: "utf8",
  })
  assert.ok(detect(main, path).length > 0)
})

test("unknown config cannot hide its Retry in Chat history", () => {
  const path = "apps/web/src/features/coach/coach-workspace.tsx"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.deepEqual(detect(clean, path), [])
  assert.ok(
    detect(clean.replaceAll('role="alert"', 'role="presentation"'), path)
      .length > 0
  )
})

test("rollback preserves accepted start receipts before gating new admissions", () => {
  const path = "apps/api/src/coach/task-start.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.deepEqual(detect(clean, path), [])
  assert.ok(
    detect(clean.replace("if (prior)", "if (missing)"), path).length > 0
  )
})

test("chat-scoped Stop cannot cancel new-client work", () => {
  const path = "apps/api/src/coach/task-store.ts"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  const mistake = clean.replace(
    ' || (!taskId && !task.startKey.startsWith("legacy-tab:"))',
    ""
  )
  assert.equal(detect(mistake, path).length, 1)
  assert.deepEqual(detect(clean, path), [])
  for (const sha of ["7a4f073e", "9e440597"]) {
    const historic = execFileSync("git", ["show", `${sha}:${path}`], {
      encoding: "utf8",
    })
    assert.equal(detect(historic, path).length, 1)
  }
})
