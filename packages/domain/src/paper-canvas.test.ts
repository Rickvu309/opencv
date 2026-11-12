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

  it("starts a CV page from a template and refuses a template on a letter", () => {
    assert.deepEqual(
      paperCanvasCommitSchema.parse({
        op: "mint",
        label: "cv",
        templateId: "modern",
      }),
      { op: "mint", label: "cv", templateId: "modern" }
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "mint",
        label: "letter",
        templateId: "modern",
      }).success,
      false
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({
        op: "mint",
        label: "cv",
        templateId: "not-a-template",
      }).success,
      false
    )
  })

  it("accepts a mint and one Word batch, and nothing older", () => {
    assert.equal(PAPER_CANVAS_PROFILE, "paper-canvas-1")
    assert.equal(
      z.toJSONSchema(paperCanvasCommitSchema, { io: "input", reused: "ref" })
        .type,
      "object"
    )
    assert.deepEqual(
      paperCanvasCommitSchema.parse({ op: "mint", label: "letter" }),
      { op: "mint", label: "letter" }
    )
    assert.deepEqual(
      paperCanvasCommitSchema.parse({ op: "mint", label: "cv" }),
      {
        op: "mint",
        label: "cv",
      }
    )
    assert.equal(
      paperCanvasCommitSchema.safeParse({ op: "mint" }).success,
      false
    )
    const batch = {
      doc: docId,
      basedOn,
      ops: [
        { op: "setText", handle: paragraph, text: "Hello", caret: 5 },
        {
          op: "setText",
          handle: paragraph,
          text: "Hello",
          caret: 0,
          lean: "after",
          keptBefore: 1,
        },
        { op: "insert", after: paragraph, text: "world" },
        { op: "delete", handle: paragraph },
      ],
    }
    assert.deepEqual(paperCanvasCommitSchema.parse({ op: "write", batch }), {
      op: "write",
      batch,
    })
    for (const ops of [
      [{ op: "setText", handle: paragraph, text: "a\nb" }],
      [{ op: "setText", handle: paragraph, text: "a", caret: -1 }],
      [{ op: "setText", handle: paragraph, text: "a", caret: 0, lean: "in" }],
      [
        {
          op: "setText",
          handle: paragraph,
          text: "a",
          caret: 0,
          lean: "after",
          keptBefore: -1,
        },
      ],
      [{ op: "split", handle: paragraph, at: 1 }],
      [],
    ])
      assert.equal(
        paperCanvasCommitSchema.safeParse({
          op: "write",
          batch: { doc: docId, basedOn, ops },
        }).success,
        false
      )
    for (const op of ["writeText", "split", "mergePrevious", "deleteParagraph"])
      assert.equal(
        paperCanvasCommitSchema.safeParse({
          op,
          docId,
          basedOn,
          paragraph,
          text: "Hi",
          at: 0,
        }).success,
        false
      )
  })
})
