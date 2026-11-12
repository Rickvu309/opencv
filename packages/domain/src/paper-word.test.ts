import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  WORD_LIMITS,
  PAPER_WORD_LIMITS,
  WORD_DOCUMENT_MEDIA_TYPE,
  wordBatchSchema,
  wordCommitSchema,
  wordConfirmedEditOpsSchema,
  wordDeleteOpSchema,
  wordFileSchema,
  wordInsertOpSchema,
  wordOpSchema,
  wordPageSchema,
  wordParagraphSchema,
  wordPieceSchema,
  wordReasonSchema,
  wordRefusalSchema,
  wordSetTextOpSchema,
  wordSourceSchema,
  wordUndoSchema,
} from "./paper-word.ts"

const doc = "11111111-1111-4111-8111-111111111111"
const basedOn = "22222222-2222-4222-8222-222222222222"
const handle = "33333333-3333-4333-8333-333333333333"
const otherHandle = "44444444-4444-4444-8444-444444444444"

describe("paper-word vocabulary", () => {
  it("parses valid operations and batch", () => {
    const setText = { op: "setText", handle, text: "Updated text" }
    const setEmptyText = { op: "setText", handle, text: "" }
    const insertAfter = { op: "insert", after: handle, text: "Inserted text" }
    const insertAtStart = { op: "insert", after: null, text: "First paragraph" }
    const deleteOp = { op: "delete", handle }

    assert.deepEqual(wordSetTextOpSchema.parse(setText), setText)
    assert.deepEqual(wordSetTextOpSchema.parse(setEmptyText), setEmptyText)
    assert.deepEqual(wordInsertOpSchema.parse(insertAfter), insertAfter)
    assert.deepEqual(wordInsertOpSchema.parse(insertAtStart), insertAtStart)
    assert.deepEqual(wordDeleteOpSchema.parse(deleteOp), deleteOp)

    assert.deepEqual(wordOpSchema.parse(setText), setText)
    assert.deepEqual(wordOpSchema.parse(insertAfter), insertAfter)
    assert.deepEqual(wordOpSchema.parse(deleteOp), deleteOp)

    const batch = {
      doc,
      basedOn,
      ops: [setText, insertAfter, insertAtStart, deleteOp],
    }
    assert.deepEqual(wordBatchSchema.parse(batch), batch)
  })

  it("refuses a batch without basedOn or with invalid basedOn", () => {
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        ops: [{ op: "setText", handle, text: "Hello" }],
      }).success,
      false
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn: null,
        ops: [{ op: "setText", handle, text: "Hello" }],
      }).success,
      false
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn: "not-a-uuid",
        ops: [{ op: "setText", handle, text: "Hello" }],
      }).success,
      false
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn: 42,
        ops: [{ op: "setText", handle, text: "Hello" }],
      }).success,
      false
    )
  })

  it("refuses unknown operations", () => {
    assert.equal(
      wordOpSchema.safeParse({
        op: "replaceText",
        handle,
        text: "Nope",
      }).success,
      false
    )
    assert.equal(
      wordOpSchema.safeParse({
        op: "split",
        handle,
      }).success,
      false
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn,
        ops: [{ op: "unknown", handle }],
      }).success,
      false
    )
  })

  it("enforces operation count limits", () => {
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn,
        ops: [],
      }).success,
      false
    )

    const maxOps = Array.from({ length: WORD_LIMITS.maxOpsPerApply }, () => ({
      op: "delete" as const,
      handle,
    }))
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn,
        ops: maxOps,
      }).success,
      true
    )

    const tooManyOps = Array.from(
      { length: WORD_LIMITS.maxOpsPerApply + 1 },
      () => ({
        op: "delete" as const,
        handle,
      })
    )
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn,
        ops: tooManyOps,
      }).success,
      false
    )

    const confirmedOps = Array.from(
      { length: WORD_LIMITS.maxOpsPerConfirmedEdit },
      () => ({
        op: "delete" as const,
        handle,
      })
    )
    assert.equal(
      wordConfirmedEditOpsSchema.safeParse(confirmedOps).success,
      true
    )

    const tooManyConfirmedOps = Array.from(
      { length: WORD_LIMITS.maxOpsPerConfirmedEdit + 1 },
      () => ({
        op: "delete" as const,
        handle,
      })
    )
    assert.equal(
      wordConfirmedEditOpsSchema.safeParse(tooManyConfirmedOps).success,
      false
    )
  })

  it("enforces text limits, newlines and control characters", () => {
    const text8KiB = "a".repeat(WORD_LIMITS.maxTextBytes)
    assert.equal(
      wordSetTextOpSchema.safeParse({
        op: "setText",
        handle,
        text: text8KiB,
      }).success,
      true
    )

    const textTooLarge = "a".repeat(WORD_LIMITS.maxTextBytes + 1)
    assert.equal(
      wordSetTextOpSchema.safeParse({
        op: "setText",
        handle,
        text: textTooLarge,
      }).success,
      false
    )

    for (const badText of [
      "line1\nline2",
      "line1\rline2",
      "line1\r\nline2",
      "line\twithtab",
      "null\u0000byte",
      "unit\u001fseparator",
      "del\u007fchar",
    ]) {
      assert.equal(
        wordSetTextOpSchema.safeParse({
          op: "setText",
          handle,
          text: badText,
        }).success,
        false
      )
      assert.equal(
        wordInsertOpSchema.safeParse({
          op: "insert",
          after: handle,
          text: badText,
        }).success,
        false
      )
    }

    const eightOpsWith8KiB = Array.from({ length: 8 }, () => ({
      op: "insert" as const,
      after: handle,
      text: "a".repeat(8 * 1024),
    }))
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn,
        ops: eightOpsWith8KiB,
      }).success,
      true
    )

    const nineOpsOver64KiB = Array.from({ length: 9 }, () => ({
      op: "insert" as const,
      after: handle,
      text: "a".repeat(8 * 1024),
    }))
    assert.equal(
      wordBatchSchema.safeParse({
        doc,
        basedOn,
        ops: nineOpsOver64KiB,
      }).success,
      false
    )
  })

  it("validates refusal shapes with handle and message", () => {
    for (const reason of [
      "stale",
      "held",
      "plain",
      "limit",
      "order",
      "closed",
      "missing",
      "foreign",
    ] as const) {
      assert.equal(wordReasonSchema.parse(reason), reason)
    }
    assert.equal(wordReasonSchema.safeParse("unknown").success, false)

    const validRefusal = {
      refused: true as const,
      reason: "held" as const,
      message: "Paragraph contains complex formatting.",
      code: "HELD_RUNS",
      handle,
    }
    assert.deepEqual(wordRefusalSchema.parse(validRefusal), validRefusal)

    const refusalWithoutHandle = {
      refused: true as const,
      reason: "stale" as const,
      message: "The document has moved.",
      code: null,
      handle: null,
    }
    assert.deepEqual(
      wordRefusalSchema.parse(refusalWithoutHandle),
      refusalWithoutHandle
    )

    assert.equal(
      wordRefusalSchema.safeParse({
        refused: false,
        reason: "held",
        message: "Refused",
        code: null,
        handle: null,
      }).success,
      false
    )
    assert.equal(
      wordRefusalSchema.safeParse({
        refused: true,
        reason: "held",
        code: null,
        handle: null,
      }).success,
      false
    )
  })

  it("validates page, paragraph, piece, undo and commit shapes", () => {
    const piece = { text: "Hello", editable: true }
    assert.deepEqual(wordPieceSchema.parse(piece), piece)

    const paragraph = {
      handle,
      text: "Hello",
      pieces: [piece],
      held: false,
      message: "",
      code: null,
    }
    assert.deepEqual(wordParagraphSchema.parse(paragraph), paragraph)

    const page = {
      doc,
      revision: basedOn,
      name: "My Document",
      label: "cv" as const,
      paragraphs: [paragraph],
    }
    assert.deepEqual(wordPageSchema.parse(page), page)

    const undo = {
      doc,
      revision: otherHandle,
      restore: basedOn,
    }
    assert.deepEqual(wordUndoSchema.parse(undo), undo)

    const commitWithUndo = {
      refused: false as const,
      page,
      undo,
    }
    assert.deepEqual(wordCommitSchema.parse(commitWithUndo), commitWithUndo)

    const commitWithoutUndo = {
      refused: false as const,
      page,
      undo: null,
    }
    assert.deepEqual(
      wordCommitSchema.parse(commitWithoutUndo),
      commitWithoutUndo
    )

    assert.equal(
      wordCommitSchema.safeParse({
        refused: true,
        page,
        undo: null,
      }).success,
      false
    )
  })

  it("validates file and source shapes and limits constants", () => {
    assert.equal(WORD_LIMITS.maxOpsPerApply, 100)
    assert.equal(WORD_LIMITS.maxOpsPerConfirmedEdit, 20)
    assert.equal(WORD_LIMITS.maxTextBytes, 8 * 1024)
    assert.equal(WORD_LIMITS.maxBatchTextBytes, 64 * 1024)
    assert.equal(WORD_LIMITS.maxEncodedBatchBytes, 96 * 1024)
    assert.equal(WORD_LIMITS.maxImportUploadBytes, 8 * 1024 * 1024)
    assert.equal(WORD_LIMITS.maxInflatedPackageBytes, 64 * 1024 * 1024)
    assert.equal(PAPER_WORD_LIMITS, WORD_LIMITS)

    const file = {
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: WORD_DOCUMENT_MEDIA_TYPE,
      revision: basedOn,
    }
    assert.deepEqual(wordFileSchema.parse(file), file)

    const readSource = { kind: "read" as const, doc, at: basedOn }
    assert.deepEqual(wordSourceSchema.parse(readSource), readSource)

    const mintSource = {
      kind: "mint" as const,
      name: "New Letter",
      label: "letter" as const,
    }
    assert.deepEqual(wordSourceSchema.parse(mintSource), mintSource)

    const importSource = {
      kind: "import" as const,
      name: "Imported",
      label: "cv" as const,
      bytes: new Uint8Array([0, 1]),
    }
    assert.deepEqual(wordSourceSchema.parse(importSource), importSource)
  })
})
