import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { z } from "zod"

import {
  PAPER_CANVAS_PROFILE,
  paperCanvasCommitSchema,
} from "./paper-canvas.ts"
import { paperPackageEditSchema } from "./paper-package.ts"

const docId = "11111111-1111-4111-8111-111111111111"
const basedOn = "22222222-2222-4222-8222-222222222222"
const paragraph = "33333333-3333-4333-8333-333333333333"

describe("blank page commits", () => {
  it("keeps Enter off the word replace", () => {
    assert.equal(
      paperPackageEditSchema.safeParse({
        docId,
        basedOn,
        edits: [
          {
            op: "split",
            targetId: `t_${"ab".repeat(32)}`,
            before: "Hello",
            after: "Hello",
          },
        ],
      }).success,
      false
    )
    assert.equal(
      paperPackageEditSchema.safeParse({
        docId,
        basedOn,
        edits: [
          {
            op: "replaceText",
            targetId: `t_${"ab".repeat(32)}`,
            before: "",
            after: "Hello",
          },
        ],
      }).success,
      false
    )
  })

  it("accepts a mint, a first write, a split, a merge, and an empty delete", () => {
    assert.equal(PAPER_CANVAS_PROFILE, "paper-canvas-1")
    assert.equal(
      z.toJSONSchema(paperCanvasCommitSchema, { io: "input", reused: "ref" })
        .type,
      "object"
    )
    assert.deepEqual(paperCanvasCommitSchema.parse({ op: "mint" }), {
      op: "mint",
    })
    assert.deepEqual(
      paperCanvasCommitSchema.parse({
        op: "writeText",
        docId,
        basedOn,
        paragraph,
        text: "Hi",
      }),
      { op: "writeText", docId, basedOn, paragraph, text: "Hi" }
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "writeText",
        docId,
        basedOn,
        paragraph,
        text: "",
      }).success,
      false
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "writeText",
        docId,
        basedOn,
        paragraph,
        text: "a\nb",
      }).success,
      false
    )
    assert.equal(
      paperPackageEditSchema.safeParse({
        docId,
        basedOn,
        edits: [
          {
            op: "writeText",
            targetId: `t_${"ab".repeat(32)}`,
            before: "Hi",
            after: "Hi",
          },
        ],
      }).success,
      false
    )
    assert.deepEqual(
      paperCanvasCommitSchema.parse({
        op: "split",
        docId,
        basedOn,
        paragraph,
        at: 0,
      }),
      { op: "split", docId, basedOn, paragraph, at: 0 }
    )
    for (const op of ["mergePrevious", "deleteParagraph"] as const) {
      assert.equal(
        paperCanvasCommitSchema.parse({ op, docId, basedOn, paragraph }).op,
        op
      )
    }
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "replaceText",
        docId,
        basedOn,
        paragraph,
      }).success,
      false
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "insertAfter",
        docId,
        basedOn,
        paragraph,
      }).success,
      false
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "split",
        docId,
        basedOn,
        paragraph,
        at: -1,
      }).success,
      false
    )
  })
})
