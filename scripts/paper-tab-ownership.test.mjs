import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  detectUnownedWriting,
  detectMissingWritingReconnect,
} from "./lib/paper-tab-ownership.mjs"

const page = path.resolve("apps/web/src/features/paper-page")
test("MISTAKE: document-only persistence and word-only sent records fire", () => {
  for (const source of [
    "store.get(docId)",
    "try { await write() } catch { opened = null }",
    "useEffect(() => { dispatch({ note: keptOnThisComputer() }); settlePage(docId) })",
    "record.sent.findLast(item => item.bases.includes(held) && item.words === seen)",
    "before.filter(item => item.words !== sent.words)",
    "record.sent.findLast(item => item.words === seen || (record.authorized.includes(item.attemptId) && item.receipt.revision === revision && item.receipt.docId === record.docId))",
    "function storageKey(docId) { return `opencv-writing:${docId}` }",
    "type SentRecord = { words: string; bases: string[]; blocks: PageBlock[] }",
  ])
    assert.equal(detectUnownedWriting(source), true)
})
test("qualified branches and immutable command provenance stay quiet", () => {
  assert.equal(
    detectUnownedWriting(
      "record.sent.findLast(item => record.authorized.includes(item.attemptId) && item.receipt.docId === record.docId && item.receipt.revision === revision && item.words === seen); store.get(key); type SentRecord = { writerId: string; attemptId: string; input: WriteInput; idempotencyKey: string; receipt: Receipt | null }"
    ),
    false
  )
})
test("local copy notices wait for storage or completed transaction evidence", () => {
  for (const source of [
    "useEffect(() => { dispatch({ note: stored.current ? keptOnThisComputer() : clearedOnReload() }); settlePage(docId) })",
    "useEffect(() => { settlePage(docId).then(outcome => dispatch({ note: outcome.local ? keptOnThisComputer() : clearedOnReload() })) })",
    "useEffect(() => { if (!stored.current) return; dispatch({ note: keptOnThisComputer() }); settlePage(docId) })",
  ])
    assert.equal(detectUnownedWriting(source), false)
})
test("Word persistence never shares its write key by document alone", () => {
  for (const file of readdirSync(page).filter(
    (name) => /\.tsx?$/.test(name) && !/\.test\./.test(name)
  ))
    assert.equal(
      detectUnownedWriting(readFileSync(path.join(page, file), "utf8")),
      false,
      file
    )
})

test("completed request failures have a bounded reconnect trigger", () => {
  assert.equal(
    detectMissingWritingReconnect(
      "useEffect(() => { settlePage(docId) }, [docId])"
    ),
    true
  )
  assert.equal(
    detectMissingWritingReconnect(
      "const connection = useWritingReconnect(docId, enabled); useEffect(() => { settlePage(docId) }, [docId])"
    ),
    true
  )
  assert.equal(
    detectMissingWritingReconnect(
      "const connection = useWritingReconnect(docId, enabled); useEffect(() => { settlePage(docId) }, [docId, connection])"
    ),
    false
  )
  assert.equal(
    detectMissingWritingReconnect(
      readFileSync(path.join(page, "canvas.tsx"), "utf8")
    ),
    false
  )
})
