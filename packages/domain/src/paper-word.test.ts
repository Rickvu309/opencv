import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  WORD_DOCUMENT_MEDIA_TYPE,
  WORD_LIMITS,
  wordBatchSchema,
  wordConfirmedOpsSchema,
  wordSourceSchema,
  wordUndoSchema,
} from "./paper-doc/paper-word.ts"

const doc = "11111111-1111-4111-8111-111111111111"
const basedOn = "22222222-2222-4222-8222-222222222222"
const handle = "33333333-3333-4333-8333-333333333333"
const restore = "44444444-4444-4444-8444-444444444444"

function batchOf(ops: unknown[]) {
  return { doc, basedOn, ops }
}

describe("a Word batch", () => {
  it("carries the three operations in the order written", () => {
    const ops = [
      { op: "setText", handle, text: "Hello" },
      { op: "insert", after: handle, text: "world" },
      { op: "insert", after: null, text: "" },
      { op: "delete", handle },
    ]
    assert.deepEqual(wordBatchSchema.parse(batchOf(ops)).ops, ops)
  })

  it("requires a revision it is based on", () => {
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        ops: [{ op: "delete", handle }],
      }).success,
      false
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn: undefined,
        ops: [{ op: "delete", handle }],
      }).success,
      false
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn: "head",
        ops: [{ op: "delete", handle }],
      }).success,
      false
    )
  })

  it("knows no operation beyond setText, insert and delete", () => {
    for (const op of [
      { op: "split", handle, at: 1 },
      { op: "replaceText", handle, text: "x", before: "y" },
      { op: "setText", handle, text: "x", properties: {} },
    ])
      assert.equal(wordBatchSchema.safeParse(batchOf([op])).success, false)
  })

  it("holds one to one hundred operations", () => {
    const one = { op: "delete", handle }
    assert.equal(wordBatchSchema.safeParse(batchOf([])).success, false)
    assert.equal(
      wordBatchSchema.safeParse(
        batchOf(Array.from({ length: WORD_LIMITS.maxOpsPerApply }, () => one))
      ).success,
      true
    )
    assert.equal(
      wordBatchSchema.safeParse(
        batchOf(
          Array.from({ length: WORD_LIMITS.maxOpsPerApply + 1 }, () => one)
        )
      ).success,
      false
    )
  })

  it("takes plain words on one line within the size limits", () => {
    const write = (text: string) =>
      wordBatchSchema.safeParse(batchOf([{ op: "setText", handle, text }]))
        .success
    assert.equal(write("é".repeat(WORD_LIMITS.maxTextBytes / 2)), true)
    assert.equal(write("é".repeat(WORD_LIMITS.maxTextBytes / 2 + 1)), false)
    for (const broken of ["a\nb", "a\rb", "a\tb", "a\u0000b", "a\u007fb"])
      assert.equal(write(broken), false)
    const chunk = "a".repeat(WORD_LIMITS.maxTextBytes)
    const filled = (count: number) =>
      wordBatchSchema.safeParse(
        batchOf(
          Array.from({ length: count }, () => ({
            op: "insert",
            after: handle,
            text: chunk,
          }))
        )
      ).success
    assert.equal(filled(WORD_LIMITS.maxBatchTextBytes / chunk.length), true)
    assert.equal(
      filled(WORD_LIMITS.maxBatchTextBytes / chunk.length + 1),
      false
    )
  })

  it("takes the caret side as lean and keptBefore together or not at all", () => {
    const setText = (side: object) =>
      wordBatchSchema.safeParse(
        batchOf([{ op: "setText", handle, text: "Hi", caret: 1, ...side }])
      )
    assert.equal(setText({}).success, true)
    assert.equal(setText({ lean: "after", keptBefore: 1 }).success, true)
    const leanOnly = setText({ lean: "after" })
    assert.equal(leanOnly.success, false)
    assert.deepEqual(leanOnly.error?.issues[0]?.path, ["ops", 0, "keptBefore"])
    assert.match(
      leanOnly.error?.issues[0]?.message ?? "",
      /lean and keptBefore together/
    )
    assert.equal(setText({ keptBefore: 0 }).success, false)
    assert.equal(
      wordConfirmedOpsSchema.safeParse([
        { op: "setText", handle, text: "Hi", lean: "before" },
      ]).success,
      false
    )
  })
})

describe("the rest of the Word vocabulary", () => {
  it("names an undo by the revision it wrote and the one it replaced", () => {
    const undo = { doc, revision: basedOn, restore }
    assert.deepEqual(wordUndoSchema.parse(undo), undo)
    assert.equal(
      wordUndoSchema.safeParse({ doc, revision: basedOn }).success,
      false
    )
  })

  it("opens a stored page or mints a blank one", () => {
    assert.equal(
      wordSourceSchema.safeParse({ kind: "read", doc }).success,
      true
    )
    assert.equal(
      wordSourceSchema.safeParse({ kind: "read", doc, at: basedOn }).success,
      true
    )
    assert.equal(
      wordSourceSchema.safeParse({ kind: "mint", name: "Page", label: "cv" })
        .success,
      true
    )
    assert.equal(
      wordSourceSchema.safeParse({ kind: "mint", name: "Page", label: "doc" })
        .success,
      false
    )
  })

  it("keeps one limit table and the Word media type", () => {
    assert.deepEqual(WORD_LIMITS, {
      maxOpsPerApply: 100,
      maxOpsPerConfirmedEdit: 20,
      maxTextBytes: 8192,
      maxBatchTextBytes: 65536,
      maxEncodedBatchBytes: 98304,
      maxImportUploadBytes: 8388608,
      maxInflatedPackageBytes: 67108864,
    })
    assert.equal(Object.isFrozen(WORD_LIMITS), true)
    assert.equal(
      WORD_DOCUMENT_MEDIA_TYPE,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  })
})
