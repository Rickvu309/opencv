import { DEFAULT_COACH_MODE, successEnvelope } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { paperUpdateContentCoachInputSchema } from "./must-edit-repair.js"
import {
  jsonSchemaForCoachInput,
  normalizeFullStream,
  toAiSdkTools,
} from "./runtime.js"

async function* replay(
  parts: Array<{ type: string } & Record<string, unknown>>
) {
  for (const part of parts) yield part
}

async function collect(
  parts: Array<{ type: string } & Record<string, unknown>>,
  mode = DEFAULT_COACH_MODE
) {
  const events = []
  for await (const event of normalizeFullStream(replay(parts), mode)) {
    events.push(event)
  }
  return events
}

describe("normalizeFullStream", () => {
  it("attaches the finish-step response.modelId to the finish event", async () => {
    const events = await collect([
      { type: "text-delta", text: "Hi." },
      {
        type: "finish-step",
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
        response: { modelId: "z-ai/glm-5.2:free" },
      },
      {
        type: "finish",
        finishReason: "stop",
        totalUsage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
      },
    ])

    expect(events).toEqual([
      { type: "text-delta", text: "Hi." },
      {
        type: "finish",
        finishReason: "stop",
        model: "z-ai/glm-5.2:free",
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cost: undefined,
        },
      },
    ])
  })

  it("keeps the last finish-step modelId when the router runs multiple steps", async () => {
    const events = await collect([
      {
        type: "finish-step",
        response: { modelId: "first/unused:free" },
      },
      {
        type: "finish-step",
        response: { modelId: "  nvidia/nemotron-3-nano:free  " },
      },
      { type: "finish", finishReason: "stop", totalUsage: {} },
    ])

    expect(events[0]).toMatchObject({
      type: "finish",
      model: "nvidia/nemotron-3-nano:free",
    })
  })

  it("rewrites a no-endpoints stream error on Free into Light-mode copy", async () => {
    const events = await collect(
      [
        {
          type: "error",
          error: new Error("No endpoints found for retired/dead-model."),
        },
      ],
      "free"
    )
    expect(events).toEqual([
      {
        type: "error",
        message: "The free Coach model isn't available right now. Try Light mode.",
      },
    ])
  })

  it("omits model when finish-step has no response.modelId", async () => {
    const events = await collect([
      { type: "finish-step", usage: { totalTokens: 3 } },
      { type: "finish", finishReason: "stop", totalUsage: { totalTokens: 3 } },
    ])
    expect(events[0]).toEqual({
      type: "finish",
      finishReason: "stop",
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: 3,
        cost: undefined,
      },
    })
  })
})

describe("toAiSdkTools", () => {
  it("converts paper_updateContent the way streamText does (asSchema.jsonSchema)", async () => {
    const tools = toAiSdkTools({
      paper_updateContent: {
        description: "Update Paper document content",
        inputSchema: paperUpdateContentCoachInputSchema,
        execute: async () => successEnvelope({ id: "doc" }),
      },
    })
    const json = await Promise.resolve(
      jsonSchemaForCoachInput(tools.paper_updateContent?.inputSchema)
    )
    expect(json).toMatchObject({ type: "object" })
    expect(json).not.toEqual(expect.any(Function))
  })

  it("never calls asSchema on a { safeParse } stub for paper_updateContent", async () => {
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
    expect(() => jsonSchemaForCoachInput(stub)).toThrow(
      /schema is not a function/
    )
    expect(() =>
      toAiSdkTools({
        paper_updateContent: {
          description: "Update Paper document content",
          inputSchema: stub,
          execute: async () => successEnvelope({ id: "doc" }),
        },
      })
    ).toThrow(/schema is not a function/)
  })
})
