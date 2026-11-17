import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectGrowingNativeJournal } from "./lib/paper-native-journal-bound.mjs"

const mistake = `
export function appendNativeJournal(storage, identity, tabId, stored) {
  const record = read(storage, key, identity)
  const seq = record.next + 1
  storage.setItem(key, JSON.stringify({
    next: seq,
    entries: [...record.entries, { seq, snapshot, idb: false, server: false }],
  }))
}
export function acknowledgeNativeJournal() {
  const entries = [...record.entries]
}
`

const clean = `
export function appendNativeJournal(storage, identity, tabId, stored) {
  const record = read(storage, key, identity)
  const seq = record.next + 1
  storage.setItem(key, JSON.stringify({
    next: seq,
    entries: [{ seq, snapshot, idb: false, server: false }],
  }))
}
export function acknowledgeNativeJournal() {
  const entries = [...record.entries]
}
`

test("a native journal append keeps only the newest snapshot of its tab", () => {
  assert.equal(detectGrowingNativeJournal(mistake).length, 1)
  assert.equal(
    detectGrowingNativeJournal(
      mistake
        .replace("[...record.entries, ", "record.entries.concat(")
        .replace("server: false }],", "server: false }),")
    ).length,
    1
  )
  assert.deepEqual(detectGrowingNativeJournal(clean), [])
  assert.equal(
    detectGrowingNativeJournal("export function other() {}").length,
    1
  )
  assert.deepEqual(
    detectGrowingNativeJournal(
      readFileSync(
        new URL("../apps/web/src/lib/paper-sync-recovery.ts", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
