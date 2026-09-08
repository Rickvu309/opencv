import {
  PAPER_CONTENT_VERSION,
  starterCvDocument,
  successEnvelope,
} from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { runFreeTextMustEdit } from "./free-must-edit.js"
import { toCoachFocusDoc } from "./must-edit.js"
import type { ModelStreamEvent } from "./translate.js"

async function collect(events: AsyncIterable<ModelStreamEvent>) {
  const out: ModelStreamEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

function sampleFocusDoc() {
  return toCoachFocusDoc({
    id: "11111111-1111-7111-8111-111111111111",
    name: "Sample internship CV",
    contentKind: "cv",
    status: "draft",
    content: starterCvDocument(),
    contentVersion: PAPER_CONTENT_VERSION,
  })
}

const rewriteAsk =
  "Rewrite the Experience checkout bullet for a product internship — smoke 2145"

const nextLine =
  "Audited product card density; proposed tighter cards and a clearer CTA."

describe("runFreeTextMustEdit", () => {
  it("applies a model line via paper_updateContent without inventing scout copy", async () => {
    const executeUpdate = vi.fn(async (input) => {
      const bullets = (
        input.content as { experience: { bullets: string[] }[] }
      ).experience[1]?.bullets
      expect(bullets?.[0]).toBe(nextLine)
      expect(bullets?.[0]).not.toMatch(/product internship/i)
      expect(bullets?.[0]).not.toMatch(/Rewritten to match the ask/)
      return successEnvelope({
        id: input.docId,
        name: "Sample internship CV",
      })
    })
    const generateLine = vi.fn(async () => ({ text: nextLine }))

    const events = await collect(
      runFreeTextMustEdit({
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        generateLine,
        toolCallId: "free-must-edit-1",
      })
    )

    expect(generateLine).toHaveBeenCalledOnce()
    expect(executeUpdate).toHaveBeenCalledOnce()
    expect(events.map((event) => event.type)).toEqual([
      "tool-call",
      "tool-result",
      "text-delta",
      "finish",
    ])
    expect(events[0]).toMatchObject({
      type: "tool-call",
      name: "paper_updateContent",
    })
    expect(events[2]).toMatchObject({
      type: "text-delta",
      text: expect.stringMatching(/Updated Sample internship CV/),
    })
    expect((events[2] as { text: string }).text).not.toMatch(/paste|apply\?/)
    expect((events[2] as { text: string }).text).not.toMatch(/!/)
  })

  it("does not call the provider when no Experience bullet scores", async () => {
    const executeUpdate = vi.fn()
    const generateLine = vi.fn()
    const events = await collect(
      runFreeTextMustEdit({
        userText: "Rewrite the Experience section to be more executive",
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        generateLine,
        toolCallId: "free-must-edit-miss",
      })
    )

    expect(generateLine).not.toHaveBeenCalled()
    expect(executeUpdate).not.toHaveBeenCalled()
    expect(events.some((event) => event.type === "error")).toBe(false)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool-result",
          name: "paper_updateContent",
          output: expect.objectContaining({
            ok: false,
            error: expect.objectContaining({
              message: "Could not match a bullet in Experience.",
            }),
          }),
        }),
      ])
    )
  })

  it("surfaces a real provider quota error without inventing a rewrite", async () => {
    const executeUpdate = vi.fn()
    const events = await collect(
      runFreeTextMustEdit({
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        generateLine: async () => ({
          error:
            "The free Coach is out of quota or rate-limited right now. Try Light mode, or try again later.",
        }),
        toolCallId: "free-must-edit-quota",
      })
    )

    expect(executeUpdate).not.toHaveBeenCalled()
    expect(events).toEqual([
      {
        type: "error",
        message:
          "The free Coach is out of quota or rate-limited right now. Try Light mode, or try again later.",
      },
    ])
  })

  it("fails closed when the model asks the User to paste", async () => {
    const executeUpdate = vi.fn()
    const events = await collect(
      runFreeTextMustEdit({
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        generateLine: async () => ({
          text: "Paste this rewrite into Experience yourself.",
        }),
        toolCallId: "free-must-edit-paste",
      })
    )

    expect(executeUpdate).not.toHaveBeenCalled()
    expect(events[1]).toMatchObject({
      type: "tool-result",
      output: {
        ok: false,
        error: { message: "Could not rewrite the line." },
      },
    })
  })
})
