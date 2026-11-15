import "fake-indexeddb/auto"

import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  branchKey,
  readBranch,
  recoveries,
  rotateWriter,
  writeBranch,
  writerFor,
} from "./canvas-branch.ts"
import {
  answerSent,
  closeRecordDb,
  commitWords,
  importSent,
  ownSent,
  pendingSent,
  recordSent,
  recoveryRecords,
} from "./canvas-save-record.ts"

const DOC = "11111111-1111-4111-8111-111111111111"
const REV = "22222222-2222-4222-8222-222222222222"
const NEXT = "33333333-3333-4333-8333-333333333333"
const HANDLE = "44444444-4444-4444-8444-444444444444"
const draft = (text: string) => ({
  blocks: [{ id: HANDLE, text }],
  caret: { blockId: HANDLE, offset: text.length },
  nextId: 2,
})
const basis = { revision: REV, words: "Original" }
async function pending(text = "My words") {
  const page = draft(text)
  writeBranch(DOC, page, basis, {})
  await commitWords(DOC, text, page.blocks, basis)
  return recordSent(DOC, {
    input: {
      op: "write",
      batch: {
        doc: DOC,
        basedOn: REV,
        ops: [{ op: "setText", handle: HANDLE, text }],
      },
    },
    words: text,
    blocks: page.blocks,
    bases: [REV],
  })
}
beforeEach(() => {
  localStorage.clear()
  rotateWriter(DOC)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await closeRecordDb()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("opencv-writing")
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
})
it("keeps each execution's durable words separately without adopting the other writer's receipts", async () => {
  const first = await pending("A unsent")
  const a = branchKey(DOC)
  const raw = localStorage.getItem(a)
  rotateWriter(DOC)
  await pending("B unsent")
  expect(branchKey(DOC)).not.toBe(a)
  expect(localStorage.getItem(a)).toBe(raw)
  const record = (
    await commitWords(DOC, "B unsent", draft("B unsent").blocks, basis)
  ).record
  expect(record.sent.map((item) => item.attemptId)).not.toContain(
    first.attemptId
  )
  expect(
    recoveries(DOC).drafts.map((item) => item.branch.draft.blocks[0]?.text)
  ).toEqual(["A unsent"])
})
it("freezes original payload/key and authorizes only the explicitly imported snapshot", async () => {
  const original = await pending()
  const snapshot = readBranch(DOC, localStorage)
  if (!snapshot) throw new Error("missing branch")
  const frozen = structuredClone(snapshot)
  await pending("Foreign future words")
  rotateWriter(DOC)
  writeBranch(DOC, draft("My words"), basis, {})
  await commitWords(DOC, "My words", draft("My words").blocks, basis)
  const imported = await importSent(DOC, frozen)
  expect(imported?.sent).toEqual([original])
  expect(imported?.authorized).toEqual([original.attemptId])
  expect(imported?.sent[0]?.writerId).not.toBe(writerFor(DOC))
  const answered = await answerSent(DOC, original, {
    generation: "package",
    docId: DOC,
    revision: NEXT,
  })
  if (!answered) throw new Error("missing receipt")
  expect(ownSent(answered, basis, NEXT, "My words")?.input).toEqual(
    original.input
  )
  expect(ownSent(answered, basis, NEXT, "Foreign future words")).toBeUndefined()
})
it("preserves malformed, unknown-version and legacy copies and still discovers valid later branches", () => {
  const prefix = `opencv-writing:${DOC}`
  localStorage.setItem(`${prefix}:broken`, "{")
  localStorage.setItem(
    `${prefix}:future`,
    JSON.stringify({ version: 99, words: "future" })
  )
  localStorage.setItem(prefix, JSON.stringify(draft("Legacy words")))
  const raw = Object.fromEntries(Object.entries(localStorage))
  writeBranch(DOC, draft("Valid words"), basis, {})
  rotateWriter(DOC)
  const found = recoveries(DOC)
  expect(found.unreadable).toBe(true)
  expect(
    found.drafts.map((item) => item.branch.draft.blocks[0]?.text).sort()
  ).toEqual(["Legacy words", "Valid words"])
  for (const [key, value] of Object.entries(raw))
    expect(localStorage.getItem(key)).toBe(value)
})
it("does not overwrite an unreadable own branch", () => {
  const key = branchKey(DOC)
  localStorage.setItem(key, "unknown copy")
  expect(writeBranch(DOC, draft("Replacement"), basis, {})).toBe(false)
  expect(localStorage.getItem(key)).toBe("unknown copy")
})
it("keeps a durable IndexedDB copy when localStorage writes are denied", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError")
  })
  expect(writeBranch(DOC, draft("Keep me"), basis, {})).toBe(false)
  const result = await commitWords(
    DOC,
    "Keep me",
    draft("Keep me").blocks,
    basis
  )
  expect(result.local.transaction).toBe("complete")
  expect(result.record.snapshot.draft.blocks).toEqual(draft("Keep me").blocks)
})

it("does not call a successful request durable when its transaction aborts", async () => {
  const put = IDBObjectStore.prototype.put
  let requestSucceeded = false
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    value,
    key
  ) {
    const request =
      key === undefined ? put.call(this, value) : put.call(this, value, key)
    request.addEventListener("success", () => {
      requestSucceeded = true
      this.transaction.abort()
    })
    return request
  })
  const result = await commitWords(
    DOC,
    "Never durable",
    draft("Never durable").blocks,
    basis
  )
  expect(requestSucceeded).toBe(true)
  expect(result.local.transaction).toBe("aborted")
  rotateWriter(DOC)
  expect(
    (await recoveryRecords(DOC)).drafts.map(
      (item) => item.branch.draft.blocks[0]?.text
    )
  ).not.toContain("Never durable")
})

it("wakes only the current branch's unresolved original attempt", async () => {
  const original = await pending()
  expect(await pendingSent(DOC)).toBe(true)
  rotateWriter(DOC)
  expect(await pendingSent(DOC)).toBe(false)
  const current = await pending("Current words")
  await answerSent(DOC, current, null, true)
  expect(await pendingSent(DOC)).toBe(false)
  const next = await pending("Later words")
  await answerSent(DOC, next, {
    generation: "package",
    docId: DOC,
    revision: NEXT,
  })
  expect(await pendingSent(DOC)).toBe(false)
  expect((await recoveryRecords(DOC)).drafts[0]?.branch.sent).toEqual([
    original,
  ])
})

it("does not wake from a successful pending read whose transaction aborts", async () => {
  await pending()
  const get = IDBObjectStore.prototype.get
  let requestSucceeded = false
  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function (
    this: IDBObjectStore,
    key
  ) {
    const request = get.call(this, key)
    request.addEventListener("success", () => {
      requestSucceeded = true
      this.transaction.abort()
    })
    return request
  })
  expect(await pendingSent(DOC)).toBe(false)
  expect(requestSucceeded).toBe(true)
})

it("requires the exact authorized receipt and head rather than identical words or handles", async () => {
  const original = await pending()
  const answered = await answerSent(DOC, original, {
    generation: "package",
    docId: DOC,
    revision: NEXT,
  })
  if (!answered) throw new Error("missing receipt")
  expect(ownSent(answered, basis, NEXT, "My words")).toEqual(answered.sent[0])
  expect(
    ownSent({ ...answered, authorized: [] }, basis, NEXT, "My words")
  ).toBeUndefined()
  expect(
    ownSent(answered, { ...basis, revision: HANDLE }, NEXT, "My words")
  ).toBeUndefined()
  expect(ownSent(answered, basis, HANDLE, "My words")).toBeUndefined()
  expect(
    ownSent(
      {
        ...answered,
        sent: answered.sent.map((item) => ({ ...item, docId: HANDLE })),
      },
      basis,
      NEXT,
      "My words"
    )
  ).toBeUndefined()
  expect(
    ownSent(
      {
        ...answered,
        sent: answered.sent.map((item) => ({
          ...item,
          receipt: { generation: "package", docId: HANDLE, revision: NEXT },
        })),
      },
      basis,
      NEXT,
      "My words"
    )
  ).toBeUndefined()
  expect(
    ownSent(
      {
        ...answered,
        sent: answered.sent.map((item) => ({
          ...item,
          blocks: [{ id: HANDLE, text: "My words" }],
          receipt: null,
        })),
      },
      basis,
      NEXT,
      "My words"
    )
  ).toBeUndefined()
  const newer = await commitWords(
    DOC,
    "My newer words",
    draft("My newer words").blocks,
    basis
  )
  expect(newer.record.generation).toBeGreaterThan(original.generation)
  expect(ownSent(newer.record, basis, NEXT, "My newer words")).toBeUndefined()
})

it("offers known legacy IndexedDB words without adopting old attempts or changing source bytes", async () => {
  await commitWords(DOC, "Current", draft("Current").blocks, basis)
  const legacy = {
    key: DOC,
    commandId: REV,
    generation: 2,
    words: "Legacy database words",
    revision: NEXT,
    idempotencyKey: HANDLE,
    sent: [
      {
        words: "Legacy database words",
        bases: [REV],
        blocks: [{ id: HANDLE, text: "Legacy database words" }],
      },
    ],
  }
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("opencv-writing", 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pages", "readwrite")
    tx.objectStore("pages").put(legacy)
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
  })
  const found = await recoveryRecords(DOC)
  expect(found.unreadable).toBe(false)
  expect(found.drafts).toHaveLength(1)
  expect(found.drafts[0]?.legacy).toBe(true)
  expect(found.drafts[0]?.branch.draft.blocks[0]?.text).toBe(
    "Legacy database words"
  )
  expect(found.drafts[0]?.branch.sent).toEqual([])
  expect(found.drafts[0]?.branch.basis).toBeNull()
  const raw = await new Promise<unknown>((resolve, reject) => {
    const request = db
      .transaction("pages", "readonly")
      .objectStore("pages")
      .get(DOC)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  expect(raw).toEqual(legacy)
  db.close()
})

it("leaves clashing attempt provenance unreadable and unchanged", async () => {
  const original = await pending()
  const key = branchKey(DOC)
  const branch = readBranch(DOC, localStorage)
  if (!branch) throw new Error("missing branch")
  const raw = JSON.stringify({ ...branch, sent: [original, original] })
  localStorage.setItem(key, raw)
  expect(readBranch(DOC, localStorage)).toBeNull()
  expect(writeBranch(DOC, draft("Replacement"), basis, {})).toBe(false)
  expect(localStorage.getItem(key)).toBe(raw)
})
