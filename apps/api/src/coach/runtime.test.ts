import { DEFAULT_COACH_MODE } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { normalizeFullStream } from "./runtime.js"

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
