import {
  ERROR_CODES,
  INVALID_COMMAND_INPUT_COPY,
  PAPER_CONTENT_VERSION,
  errorEnvelope,
  starterCvDocument,
  successEnvelope,
} from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { guaranteeMustEditStream } from "./must-edit-guarantee.js"
import { MUST_EDIT_APPLY_FAILED_COPY } from "./must-edit-repair.js"
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
  it("attempts paper_updateContent after a read-only rewrite without inventing scout copy", async () => {
    const executeUpdate = vi.fn()
    const originalBullet = starterCvDocument().experience[1]?.bullets[0]

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
      toolCallId: "must-edit-1",
      input: {
        docId: "11111111-1111-7111-8111-111111111111",
        contentVersion: PAPER_CONTENT_VERSION,
      },
    })
    const bullets = (
      events[2] as {
        input: { content: { experience: { bullets: string[] }[] } }
      }
    ).input.content.experience[1]?.bullets
    expect(bullets?.[0]).toBe(originalBullet)
    expect(bullets?.[0]).not.toMatch(/framed for a product internship/)
    expect(bullets?.[0]).not.toMatch(/Rewritten to match the ask/)
    expect(events[3]).toMatchObject({
      type: "tool-result",
      name: "paper_updateContent",
      output: {
        ok: false,
        error: {
          message: "Could not rewrite the line.",
        },
      },
    })
    expect(events[4]).toMatchObject({
      type: "text-delta",
      text: "Could not rewrite the line. Next step: try sending the ask again.",
    })
    expect((events[4] as { text: string }).text).not.toMatch(/paste|apply\?/)
    expect((events[4] as { text: string }).text).not.toMatch(/!/)
  })

  it("still applies paper_updateContent when a rewrite is supplied", async () => {
    const next =
      "Audited product card density; proposed tighter cards and a clearer CTA."
    const executeUpdate = vi.fn(async (input) => {
      expect(input.docId).toBe("11111111-1111-7111-8111-111111111111")
      const bullets = (
        input.content as { experience: { bullets: string[] }[] }
      ).experience[1]?.bullets
      expect(bullets?.[0]).toBe(next)
      expect(bullets?.[0]).not.toMatch(/product internship/i)
      expect(bullets?.[0]).not.toMatch(/Rewritten to match the ask/)
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
        rewriteText: () => next,
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
      "Should I edit the Education section?",
      "How do I sharpen my Skills section?",
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

  it("does not rewrite Summary when Education or Skills is named", async () => {
    const executeUpdate = vi.fn()
    const focusDoc = sampleFocusDoc()
    const summary = starterCvDocument().summary

    for (const [userText, receipt, nextStep] of [
      [
        "Rewrite the Education section to be clearer",
        "Could not rewrite Education.",
        /Could not rewrite Education\. Next step: name .*Information Systems/,
      ],
      [
        "Sharpen my Skills section",
        "Could not rewrite Skills.",
        /Could not rewrite Skills\. Next step: name .*Product/,
      ],
    ] as const) {
      executeUpdate.mockClear()
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
          userText,
          hasFocusDoc: true,
          focusDoc,
          executeUpdate,
          rewriteText: () => "Should not land on Summary",
          toolCallId: "must-edit-other-1",
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
        toolCallId: "must-edit-other-1",
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
            message: receipt,
          },
        },
      })
      expect(events[4]).toMatchObject({
        type: "text-delta",
        text: expect.stringMatching(nextStep),
      })
      expect((events[4] as { text: string }).text).not.toMatch(/paste|apply\?/)
      expect((events[4] as { text: string }).text).not.toMatch(/!/)
    }
  })

  it("maps a dumped paper_updateContent Experience miss to a failed receipt and role next-step", async () => {
    const executeUpdate = vi.fn()
    const focusDoc = sampleFocusDoc()
    const summary = starterCvDocument().summary
    const dump = [
      "paper_updateContent",
      JSON.stringify({
        docId: focusDoc.id,
        contentVersion: focusDoc.contentVersion,
        content: focusDoc.content,
      }),
    ].join(" ")
    const events = await collect(
      [
        { type: "text-delta", text: dump },
        {
          type: "text-delta",
          text: " Could not match a bullet in Experience.",
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: "Rewrite the Experience section to be more executive",
        hasFocusDoc: true,
        focusDoc,
        executeUpdate,
        toolCallId: "must-edit-dump-1",
      }
    )

    expect(executeUpdate).not.toHaveBeenCalled()
    const text = events
      .filter((event): event is { type: "text-delta"; text: string } =>
        event.type === "text-delta"
      )
      .map((event) => event.text)
      .join("")
    expect(text).not.toMatch(/paper[_]?updateContent/i)
    expect(text).not.toContain("{")
    expect(text).not.toContain(focusDoc.id)
    expect(text).toMatch(/Product discovery lead/)
    expect(text).toMatch(/Checkout UX/)
    expect(text).toMatch(/Next step:/)
    expect(text).not.toMatch(new RegExp(summary.slice(0, 24)))
    expect(events.some((event) => event.type === "tool-call")).toBe(true)
    expect(events.some((event) => event.type === "tool-result")).toBe(true)
    const update = events.find(
      (event) =>
        event.type === "tool-call" && event.name === "paper_updateContent"
    ) as { input: { content: { summary: string } } } | undefined
    expect(update?.input.content.summary).toBe(summary)
    const result = events.find((event) => event.type === "tool-result")
    expect(result).toMatchObject({
      type: "tool-result",
      name: "paper_updateContent",
      output: {
        ok: false,
        error: { message: "Could not match a bullet in Experience." },
      },
    })
  })

  it("keeps a failed model paper_updateContent and adds a role next-step after dump text", async () => {
    const executeUpdate = vi.fn()
    const focusDoc = sampleFocusDoc()
    const summary = starterCvDocument().summary
    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "model-1",
          name: "paper_updateContent",
          input: {
            docId: focusDoc.id,
            contentVersion: focusDoc.contentVersion,
            content: focusDoc.content,
          },
        },
        {
          type: "tool-result",
          toolCallId: "model-1",
          name: "paper_updateContent",
          output: errorEnvelope(
            ERROR_CODES.VALIDATION_ERROR,
            "Could not match a bullet in Experience."
          ),
        },
        {
          type: "text-delta",
          text: `paper_updateContent ${JSON.stringify({
            docId: focusDoc.id,
            content: focusDoc.content,
          })}`,
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: "Rewrite the Experience section to be more executive",
        hasFocusDoc: true,
        focusDoc,
        executeUpdate,
      }
    )

    expect(executeUpdate).not.toHaveBeenCalled()
    expect(
      events.filter(
        (event) =>
          event.type === "tool-call" && event.name === "paper_updateContent"
      )
    ).toHaveLength(1)
    const text = events
      .filter((event): event is { type: "text-delta"; text: string } =>
        event.type === "text-delta"
      )
      .map((event) => event.text)
      .join("")
    expect(text).not.toMatch(/paper[_]?updateContent/i)
    expect(text).not.toContain("{")
    expect(text).toMatch(/Product discovery lead/)
    expect(text).toMatch(/Checkout UX/)
    expect(text).toMatch(/Next step:/)
    expect(text).not.toMatch(new RegExp(summary.slice(0, 24)))
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

  it("drops version/invalid-input flashes when a later update succeeds", async () => {
    const executeUpdate = vi.fn()
    const content = structuredClone(starterCvDocument())
    const next =
      "Audited product card density; proposed tighter cards and a clearer CTA."
    const bullets = content.experience[1]?.bullets
    if (bullets) bullets[0] = next

    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "bad-version",
          name: "paper_updateContent",
          input: {
            docId: "11111111-1111-7111-8111-111111111111",
            contentVersion: 2,
            content,
          },
        },
        {
          type: "tool-result",
          toolCallId: "bad-version",
          name: "paper_updateContent",
          output: {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Unsupported content version",
            },
          },
        },
        {
          type: "tool-call",
          toolCallId: "bad-input",
          name: "paper_updateContent",
          input: { docId: "11111111-1111-7111-8111-111111111111" },
        },
        {
          type: "tool-error",
          toolCallId: "bad-input",
          name: "paper_updateContent",
          error:
            'Invalid input for tool paper_updateContent: Type validation failed: [{"code":"invalid_type"}]',
        },
        {
          type: "tool-call",
          toolCallId: "ok-1",
          name: "paper_updateContent",
          input: {
            docId: "11111111-1111-7111-8111-111111111111",
            contentVersion: PAPER_CONTENT_VERSION,
            content,
          },
        },
        {
          type: "tool-result",
          toolCallId: "ok-1",
          name: "paper_updateContent",
          output: successEnvelope({
            id: "11111111-1111-7111-8111-111111111111",
            name: "Sample internship CV",
          }),
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
    expect(events.map((event) => event.type)).toEqual([
      "tool-call",
      "tool-result",
      "finish",
    ])
    expect(events[0]).toMatchObject({
      type: "tool-call",
      toolCallId: "ok-1",
      name: "paper_updateContent",
    })
    expect(events[1]).toMatchObject({
      type: "tool-result",
      toolCallId: "ok-1",
    })
    const dumped = JSON.stringify(events)
    expect(dumped).not.toMatch(/Unsupported content version/)
    expect(dumped).not.toMatch(/The input wasn't valid/)
    expect(dumped).not.toMatch(/paste|apply\?/)
  })

  it("retries a stale contentVersion once and emits only the successful receipt", async () => {
    const content = structuredClone(starterCvDocument())
    const next =
      "Audited product card density; proposed tighter cards and a clearer CTA."
    const bullets = content.experience[1]?.bullets
    if (bullets) bullets[0] = next

    const executeUpdate = vi.fn(async (input) => {
      expect(input.contentVersion).toBe(PAPER_CONTENT_VERSION)
      expect(input.docId).toBe("11111111-1111-7111-8111-111111111111")
      expect(
        (input.content as { experience: { bullets: string[] }[] }).experience[1]
          ?.bullets[0]
      ).toBe(next)
      return successEnvelope({
        id: input.docId,
        name: "Sample internship CV",
      })
    })

    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "stale-1",
          name: "paper_updateContent",
          input: {
            docId: "11111111-1111-7111-8111-111111111111",
            contentVersion: 2,
            content,
          },
        },
        {
          type: "tool-result",
          toolCallId: "stale-1",
          name: "paper_updateContent",
          output: {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Unsupported content version",
            },
          },
        },
        {
          type: "tool-call",
          toolCallId: "stale-2",
          name: "paper_updateContent",
          input: {
            docId: "11111111-1111-7111-8111-111111111111",
            contentVersion: "1",
            content: {
              id: "11111111-1111-7111-8111-111111111111",
              name: "Sample internship CV",
              kind: "cv",
              contentVersion: 2,
              content,
            },
          },
        },
        {
          type: "tool-error",
          toolCallId: "stale-2",
          name: "paper_updateContent",
          error: INVALID_COMMAND_INPUT_COPY,
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        toolCallId: "must-edit-retry-1",
      }
    )

    expect(executeUpdate).toHaveBeenCalledOnce()
    expect(events.map((event) => event.type)).toEqual([
      "tool-call",
      "tool-result",
      "finish",
    ])
    expect(events[0]).toMatchObject({
      type: "tool-call",
      name: "paper_updateContent",
      toolCallId: "must-edit-retry-1",
      input: {
        docId: "11111111-1111-7111-8111-111111111111",
        contentVersion: PAPER_CONTENT_VERSION,
      },
    })
    expect(events[1]).toMatchObject({
      type: "tool-result",
      name: "paper_updateContent",
      output: { ok: true },
    })
    const dumped = JSON.stringify(events)
    expect(dumped).not.toMatch(/Unsupported content version/)
    expect(dumped).not.toMatch(/The input wasn't valid/)
    expect(dumped).not.toMatch(/paste|apply\?/)
  })

  it("emits one honest failure when a version conflict cannot be repaired", async () => {
    const executeUpdate = vi.fn()
    const events = await collect(
      [
        {
          type: "tool-call",
          toolCallId: "junk-1",
          name: "paper_updateContent",
          input: { docId: "11111111-1111-7111-8111-111111111111" },
        },
        {
          type: "tool-result",
          toolCallId: "junk-1",
          name: "paper_updateContent",
          output: {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Unsupported content version",
            },
          },
        },
        {
          type: "tool-call",
          toolCallId: "junk-2",
          name: "paper_updateContent",
          input: { contentVersion: 2, content: { markdown: 4 } },
        },
        {
          type: "tool-error",
          toolCallId: "junk-2",
          name: "paper_updateContent",
          error: INVALID_COMMAND_INPUT_COPY,
        },
        { type: "finish", finishReason: "stop", usage: {} },
      ],
      {
        userText: rewriteAsk,
        hasFocusDoc: true,
        focusDoc: sampleFocusDoc(),
        executeUpdate,
        toolCallId: "must-edit-fail-1",
      }
    )

    expect(executeUpdate).not.toHaveBeenCalled()
    const results = events.filter((event) => event.type === "tool-result")
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      type: "tool-result",
      output: {
        ok: false,
        error: { message: MUST_EDIT_APPLY_FAILED_COPY },
      },
    })
    const dumped = JSON.stringify(events)
    expect(dumped).not.toMatch(/Unsupported content version/)
    expect(dumped).not.toMatch(/The input wasn't valid/)
    expect(dumped).not.toMatch(/paste|apply\?/)
    expect(events.some((event) => event.type === "text-delta")).toBe(true)
    expect(
      (events.find((event) => event.type === "text-delta") as { text: string })
        .text
    ).toMatch(/try sending the rewrite again/)
  })
})
