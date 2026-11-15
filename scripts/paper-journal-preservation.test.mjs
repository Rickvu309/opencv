import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectJournalErasure } from "./lib/paper-local-durable.mjs"

const clean = `
function parse(raw) {
  if (!raw) return empty()
  try {
    const result = schema.safeParse(JSON.parse(raw))
    return result.success ? result.data : "denied"
  } catch { return "denied" }
}
`

test("unreadable recovery journals cannot be replaced as empty", () => {
  assert.deepEqual(detectJournalErasure(clean), [])
  assert.ok(
    detectJournalErasure(
      clean.replace('result.data : "denied"', "result.data : empty()")
    ).length > 0
  )
  assert.ok(
    detectJournalErasure(
      clean.replace('catch { return "denied" }', "catch { return empty() }")
    ).length > 0
  )
  assert.ok(
    detectJournalErasure(
      `${clean}\nfunction recoverJournals(storage) { try { return storage.length } catch { return [] } }`
    ).length > 0
  )
  assert.deepEqual(
    detectJournalErasure(
      readFileSync(
        new URL("../apps/web/src/lib/paper-sync-journal.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
