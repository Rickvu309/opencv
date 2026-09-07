import {
  INVALID_COMMAND_INPUT_COPY,
  PAPER_CONTENT_VERSION,
  starterCvDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  MUST_EDIT_APPLY_FAILED_COPY,
  isRecoverableUpdateFailure,
  isSuccessfulToolOutput,
  paperUpdateContentCoachInputSchema,
  repairPaperUpdateInput,
  toolFailureMessage,
} from "./must-edit-repair.js"
import { toCoachFocusDoc } from "./must-edit.js"

const DOC_ID = "11111111-1111-7111-8111-111111111111"

function sampleFocusDoc() {
  return toCoachFocusDoc({
    id: DOC_ID,
    name: "Sample internship CV",
    contentKind: "cv",
    status: "draft",
    content: starterCvDocument(),
    contentVersion: PAPER_CONTENT_VERSION,
  })
}

const rewritten =
  "Audited product card density; proposed tighter cards and a clearer CTA."

function rewrittenContent() {
  const content = structuredClone(starterCvDocument())
  const bullets = content.experience[1]?.bullets
  if (bullets) bullets[0] = rewritten
  return content
}

describe("repairPaperUpdateInput", () => {
  it("coerces an incremented or string contentVersion to the supported schema", () => {
    const content = rewrittenContent()
    const fromBump = repairPaperUpdateInput(
      { docId: DOC_ID, contentVersion: 2, content },
      sampleFocusDoc()
    )
    const fromString = repairPaperUpdateInput(
      { docId: DOC_ID, contentVersion: "1", content },
      sampleFocusDoc()
    )

    expect(fromBump).toEqual({
      docId: DOC_ID,
      contentVersion: PAPER_CONTENT_VERSION,
      content,
    })
    expect(fromString).toEqual(fromBump)
  })

  it("unwraps a nested getDoc DTO and strips unknown keys", () => {
    const content = rewrittenContent()
    const repaired = repairPaperUpdateInput(
      {
        docId: DOC_ID,
        contentVersion: 2,
        content: {
          id: DOC_ID,
          name: "Sample internship CV",
          kind: "cv",
          status: "draft",
          contentVersion: 2,
          content: {
            ...content,
            experience: content.experience.map((role) => ({
              ...role,
              id: "extra-role-id",
            })),
          },
        },
      },
      sampleFocusDoc()
    )

    expect(repaired?.contentVersion).toBe(PAPER_CONTENT_VERSION)
    expect(repaired?.docId).toBe(DOC_ID)
    expect(repaired?.content).toEqual(content)
    expect(JSON.stringify(repaired?.content)).not.toMatch(/extra-role-id/)
  })

  it("overlays a partial body onto the open document", () => {
    const repaired = repairPaperUpdateInput(
      {
        docId: "not-a-uuid",
        content: { summary: "One tighter summary sentence." },
      },
      sampleFocusDoc()
    )

    expect(repaired?.docId).toBe(DOC_ID)
    expect(repaired?.contentVersion).toBe(PAPER_CONTENT_VERSION)
    expect(repaired?.content).toMatchObject({
      ...starterCvDocument(),
      summary: "One tighter summary sentence.",
    })
  })

  it("returns null when the body cannot be decoded even after overlay", () => {
    expect(
      repairPaperUpdateInput(
        { docId: DOC_ID, contentVersion: 2, content: { markdown: 4 } },
        sampleFocusDoc()
      )
    ).toBeNull()
  })
})

describe("recoverable update failures", () => {
  it("treats version and invalid-input chrome as recoverable", () => {
    expect(isRecoverableUpdateFailure("Unsupported content version")).toBe(true)
    expect(isRecoverableUpdateFailure(INVALID_COMMAND_INPUT_COPY)).toBe(true)
    expect(
      isRecoverableUpdateFailure(
        'Invalid input for tool paper_updateContent: Type validation failed: [{"code":"invalid_type"}]'
      )
    ).toBe(true)
    expect(
      isRecoverableUpdateFailure("Content version must be a positive integer")
    ).toBe(true)
    expect(isRecoverableUpdateFailure("Paper doc not found")).toBe(false)
    expect(MUST_EDIT_APPLY_FAILED_COPY).not.toMatch(/unsupported|wasn't valid/i)
  })

  it("reads envelope and tool-error shapes", () => {
    expect(isSuccessfulToolOutput({ ok: true, data: { id: DOC_ID } })).toBe(true)
    expect(
      toolFailureMessage({
        ok: false,
        error: { message: "Unsupported content version" },
      })
    ).toBe("Unsupported content version")
    expect(toolFailureMessage(new Error("The input wasn't valid"))).toBe(
      "The input wasn't valid"
    )
  })

  it("lets a Free-shaped tool payload through the coach schema", () => {
    expect(
      paperUpdateContentCoachInputSchema.safeParse({
        docId: DOC_ID,
        contentVersion: "1",
        content: rewrittenContent(),
        extra: true,
      }).success
    ).toBe(true)
    expect(paperUpdateContentCoachInputSchema.safeParse("nope").success).toBe(
      false
    )
  })

  it("is a Zod 4 / Standard Schema so AI SDK does not call it as a function", () => {
    expect("_zod" in paperUpdateContentCoachInputSchema).toBe(true)
    expect("~standard" in paperUpdateContentCoachInputSchema).toBe(true)

    const stub = {
      safeParse(input: unknown) {
        return input && typeof input === "object"
          ? { success: true as const, data: input }
          : {
              success: false as const,
              error: { issues: [{ message: "Invalid command input" }] },
            }
      },
    }
    expect("~standard" in stub).toBe(false)
  })
})
