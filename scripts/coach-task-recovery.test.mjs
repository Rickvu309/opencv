import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/coach-task-recovery.mjs"

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
