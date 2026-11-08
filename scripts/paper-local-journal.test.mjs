import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectSynchronousJournal } from "./lib/paper-local-durable.mjs"

const TIMER = ["set", "Timeout"].join("")

const clean = `
const journalId = () => journalScope(docId, tabId)
function rememberLocal() { appendJournal(storage, journalId(), update, client.stored()) }
client.subscribe(() => { rememberLocal(); void save() })
`

test("input journals are synchronous and belong to one tab", () => {
  assert.deepEqual(detectSynchronousJournal(clean), [])
  assert.ok(
    detectSynchronousJournal(
      clean.replace("update, client.stored()", "update")
    ).some((hit) => hit.includes("epoch and basis"))
  )
  assert.ok(
    detectSynchronousJournal(`
    client.subscribe(() => { void save() })
  `).length > 0
  )
  assert.ok(
    detectSynchronousJournal(`
    const journalId = () => journalScope(docId, tabId)
    function rememberLocal() { appendJournal(storage, journalId(), update) }
    client.subscribe(() => { ${TIMER}(() => rememberLocal(), 50) })
  `).length > 0
  )
  assert.ok(
    detectSynchronousJournal(`
    const journalId = () => journalScope(docId)
    function rememberLocal() { appendJournal(storage, journalId(), update) }
    client.subscribe(() => { rememberLocal(); void save() })
  `).length > 0
  )
  assert.deepEqual(
    detectSynchronousJournal(
      readFileSync(
        new URL("../apps/web/src/lib/paper-sync.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
