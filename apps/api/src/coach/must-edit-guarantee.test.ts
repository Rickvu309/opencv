import {
  PAPER_CONTENT_VERSION,
  starterCvDocument,
  successEnvelope,
} from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { guaranteeMustEditStream } from "./must-edit-guarantee.js"
import { toCoachFocusDoc } from "./must-edit.js"
import type { ModelStreamEvent } from "./translate.js"

async function* replay(events: ModelStreamEvent[]) {
  for (const event of events) yield event
}

async function collect(
  events: ModelStreamEvent[],
  options: Parameters<typeof guaranteeMustEditStream>[1]
) {
  const out: ModelStreamEvent[] = []
  for await (const event of guaranteeMustEditStream(replay(events), options)) {
    out.push(event)
  }
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
  "Rewrite the Experience checkout bullet for a product internship"

describe("guaranteeMustEditStream", () => {
  it("applies paper_updateContent after a read-only rewrite turn", async () => {
    const executeUpdate = vi.fn(async (input) => {
      expect(input.docId).toBe("11111111-1111-7111-8111-111111111111")
      const bullets = (
        input.content as { experience: { bullets: string[] }[] }
      ).experience[1]?.bullets
      expect(bullets?.[0]).toMatch(/product internship/i)
      expect(bullets?.[0]).not.toBe(
        starterCvDocument().experience[1]?.bullets[0]
      )
      return successEnvelope({
        id: input.docId,
        name: "Sample internship CV",
      })
    })

    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "read-1",
          name: "paper_getDoc",
          input: { docId: "11111111-1111-7111-8111-111111111111" },
        },
        {
          type: "tool-result",
          toolCallId: "read-1",
          name: "paper_getDoc",
          output: { ok: true, data: { name: "Sample internship CV" } },
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        toolCallId: "must-edit-1",
      }
    )

    expect(executeUpdate).toHaveBeenCalledOnce()
    expect(events.map((event) => event.type)).toEqual([
      "tool-call",
      "tool-result",
      "tool-call",
      "tool-result",
      "text-delta",
      "finish",
    ])
    expect(events[2]).toMatchObject({
      type: "tool-call",
      name: "paper_updateContent",
      toolCallId: "must-edit-1",
    })
    expect(events[3]).toMatchObject({
      type: "tool-result",
      name: "paper_updateContent",
    })
    expect(events[4]).toMatchObject({
      type: "text-delta",
      text: expect.stringMatching(/Updated Sample internship CV/),
    })
    expect((events[4] as { text: string }).text).not.toMatch(/paste|apply\?/)
  })

  it("does not mutate on QVE-188 advice after a read", async () => {
    const executeUpdate = vi.fn()
    for (const userText of [
      "How do I edit my summary?",
      "Can you fix my interview nerves?",
    ]) {
      executeUpdate.mockClear()
      const events = await collect(
        [
          {
            type: "tool-call",
            toolCallId: "read-1",
            name: "paper_getDoc",
            input: {},
          },
          {
            type: "tool-result",
            toolCallId: "read-1",
            name: "paper_getDoc",
            output: { ok: true },
          },
          {
            type: "text-delta",
            text: "Open the Summary field and rewrite it there.",
          },
          { type: "finish", finishReason: "stop", usage: {} },
        ],
        {
          userText,
          hasFocusDoc: true,
          focusDoc: sampleFocusDoc(),
          executeUpdate,
        }
      )
      expect(executeUpdate).not.toHaveBeenCalled()
      expect(events.some((event) => event.type === "tool-call" && event.name === "paper_updateContent")).toBe(
        false
      )
    }
  })

  it("does not rewrite Summary when Experience is named but no bullet scores", async () => {
    const executeUpdate = vi.fn()
    const focusDoc = sampleFocusDoc()
    const summary = starterCvDocument().summary
    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "read-1",
          name: "paper_getDoc",
          input: { docId: focusDoc.id },
        },
        {
          type: "tool-result",
          toolCallId: "read-1",
          name: "paper_getDoc",
          output: { ok: true, data: { name: focusDoc.name } },
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: "Rewrite the Experience section to be more executive",
        hasFocusDoc: true,
        focusDoc,
        executeUpdate,
        toolCallId: "must-edit-miss-1",
      }
    )

    expect(executeUpdate).not.toHaveBeenCalled()
    expect(events.map((event) => event.type)).toEqual([
      "tool-call",
      "tool-result",
      "tool-call",
      "tool-result",
      "text-delta",
      "finish",
    ])
    expect(events[2]).toMatchObject({
      type: "tool-call",
      name: "paper_updateContent",
      toolCallId: "must-edit-miss-1",
      input: {
        docId: focusDoc.id,
        contentVersion: focusDoc.contentVersion,
        content: focusDoc.content,
      },
    })
    const updateInput = (
      events[2] as { input: { content: { summary: string } } }
    ).input
    expect(updateInput.content.summary).toBe(summary)
    expect(events[3]).toMatchObject({
      type: "tool-result",
      name: "paper_updateContent",
      output: {
        ok: false,
        error: {
          message: "Could not match a bullet in Experience.",
        },
      },
    })
    expect(events[4]).toMatchObject({
      type: "text-delta",
      text: expect.stringMatching(
        /Could not match a bullet in Experience\. Next step: name .*Product discovery lead.*Checkout UX/
      ),
    })
    expect((events[4] as { text: string }).text).not.toMatch(/paste|apply\?/)
    expect((events[4] as { text: string }).text).not.toMatch(/!/)
  })

  it("leaves a successful model update alone", async () => {
    const executeUpdate = vi.fn()
    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "up-1",
          name: "paper_updateContent",
          input: {},
        },
        {
          type: "tool-result",
          toolCallId: "up-1",
          name: "paper_updateContent",
          output: { ok: true },
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
      }
    )
    expect(executeUpdate).not.toHaveBeenCalled()
    expect(events).toHaveLength(3)
  })
})
