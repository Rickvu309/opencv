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
