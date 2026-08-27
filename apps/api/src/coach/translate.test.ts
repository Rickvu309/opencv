import { DEFAULT_COACH_MODEL } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { commandRegistry } from "../commands/index.js"
import { reversalForTool } from "./receipts.js"
import {
  estimateCostUsd,
  partsFromModelStream,
  tokensFromUsage,
  type ModelStreamEvent,
} from "./translate.js"

async function collect(events: ModelStreamEvent[]) {
  const parts = []
  for await (const part of partsFromModelStream(replay(events), {
    model: DEFAULT_COACH_MODEL,
    startedAt: Date.now() - 12,
    reversalFor: (name) => reversalForTool(name, commandRegistry),
  })) {
    parts.push(part)
  }
  return parts
}

async function* replay(events: ModelStreamEvent[]) {
  for (const event of events) yield event
}

describe("partsFromModelStream", () => {
  it("translates text, tools, and a truthful receipt into port parts", async () => {
    const parts = await collect([
      { type: "text-delta", text: "I'll move the starred card." },
      {
        type: "tool-call",
        toolCallId: "call_1",
        name: "apply_moveCard",
        input: { cardId: "c1", stage: "prep" },
      },
      {
        type: "tool-result",
        toolCallId: "call_1",
        name: "apply_moveCard",
        output: {
          ok: true,
          data: {
            title: "Associate PM intern",
            company: "Local startup",
            stage: "prep",
          },
        },
      },
      {
        type: "finish",
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140, cost: 0.0021 },
      },
    ])

    expect(parts.map((part) => part.type)).toEqual([
      "text-delta",
      "tool-call",
      "tool-result",
      "finish",
    ])
    expect(parts[2]).toEqual({
      type: "tool-result",
      toolCallId: "call_1",
      name: "apply_moveCard",
      summary: "Moved Associate PM intern at Local startup to Prep",
      ok: true,
      reversal: {
        possible: true,
        command: "apply.moveCard",
        description:
          "Undo by moving the card back to its previous Stage and order.",
      },
      result: {
        ok: true,
        data: {
          title: "Associate PM intern",
          company: "Local startup",
          stage: "prep",
        },
      },
    })
    expect(parts[3]).toEqual({
      type: "finish",
      finishReason: "stop",
      usage: {
        model: DEFAULT_COACH_MODEL,
        tokens: 140,
        costEstimate: "0.002100",
        latencyMs: expect.any(Number),
        finishReason: "stop",
      },
    })
    const finish = parts[3]
    if (finish?.type === "finish") {
      expect(finish.usage.latencyMs).toBeGreaterThanOrEqual(12)
    }
  })

  it("prefers a hydrated reversal on the tool envelope", async () => {
    const parts = await collect([
      {
        type: "tool-result",
        toolCallId: "call_3",
        name: "apply_createCard",
        output: {
          ok: true,
          data: {
            id: "card-1",
            title: "Intern",
            company: "Acme",
            stage: "inbox",
          },
          reversal: {
            possible: true,
            command: "apply.deleteCard",
            description: "Undo by deleting the Apply card.",
            input: { cardId: "card-1" },
          },
        },
      },
      { type: "finish", finishReason: "stop", usage: {} },
    ])
    expect(parts[0]).toEqual({
      type: "tool-result",
      toolCallId: "call_3",
      name: "apply_createCard",
      summary: "Created Intern at Acme",
      ok: true,
      reversal: {
        possible: true,
        command: "apply.deleteCard",
        description: "Undo by deleting the Apply card.",
        input: { cardId: "card-1" },
      },
      result: {
        ok: true,
        data: {
          id: "card-1",
          title: "Intern",
          company: "Acme",
          stage: "inbox",
        },
      },
    })
  })

  it("humanizes a tool-error Zod dump into a short fail sentence", async () => {
    const parts = await collect([
      {
        type: "tool-error",
        toolCallId: "call_bad",
        name: "apply_moveCard",
        error: new Error(
          'Invalid input for tool apply_moveCard: Type validation failed: Value: {"cardId":"00000000-0000-0000-0000-000000000002"}. Error message: [{"code":"invalid_format","pattern":"/^[0-9a-fA-F]{8}$/"}]'
        ),
      },
      { type: "finish", finishReason: "stop", usage: {} },
    ])
    expect(parts[0]).toMatchObject({
      type: "tool-result",
      toolCallId: "call_bad",
      name: "apply_moveCard",
      summary: "That card id isn't valid",
      ok: false,
    })
    if (parts[0]?.type === "tool-result") {
      expect(parts[0].summary).not.toMatch(/Invalid input|Type validation|\{/)
    }
  })

  it("does not attach a reversal when the tool failed", async () => {
    const parts = await collect([
      {
        type: "tool-result",
        toolCallId: "call_2",
        name: "apply_moveCard",
        output: {
          ok: false,
          error: { code: "NOT_FOUND", message: "Apply card not found" },
        },
      },
      { type: "finish", finishReason: "stop", usage: {} },
    ])
    expect(parts[0]).toEqual({
      type: "tool-result",
      toolCallId: "call_2",
      name: "apply_moveCard",
      summary: "Apply card not found",
      ok: false,
      result: {
        ok: false,
        error: { code: "NOT_FOUND", message: "Apply card not found" },
      },
    })
  })

  it("prefers the resolved model id from finish over the requested slug", async () => {
    const parts = await collect([
      { type: "text-delta", text: "Done." },
      {
        type: "finish",
        finishReason: "stop",
        model: "z-ai/glm-5.2:free",
        usage: { totalTokens: 12 },
      },
    ])
    expect(parts[1]).toEqual({
      type: "finish",
      finishReason: "stop",
      usage: {
        model: "z-ai/glm-5.2:free",
        tokens: 12,
        costEstimate: expect.any(String),
        latencyMs: expect.any(Number),
        finishReason: "stop",
      },
    })
  })
})

describe("usage helpers", () => {
  it("prefers provider cost and falls back to a Claude-class estimate", () => {
    expect(tokensFromUsage({ totalTokens: 20 })).toBe(20)
    expect(tokensFromUsage({ inputTokens: 10, outputTokens: 5 })).toBe(15)
    expect(estimateCostUsd({ cost: 0.001234 })).toBe("0.001234")
    expect(
      estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 })
    ).toBe("18.000000")
  })
})
