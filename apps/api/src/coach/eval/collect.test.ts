import { describe, expect, it } from "vitest"

import { createDemoCoachRuntime } from "../fake.js"
import { collectTranscript } from "./collect.js"

describe("collectTranscript", () => {
  it("folds a scripted runtime into text plus paired tool records", async () => {
    const transcript = await collectTranscript(createDemoCoachRuntime(), {
      userId: "eval-user",
      threadId: "11111111-1111-4111-8111-111111111111",
      history: [],
    })

    expect(transcript.text).toBe("I looked at Apply. Prep the starred one next.")
    expect(transcript.toolCalls).toEqual([
      { toolCallId: "call_1", name: "apply_listCards", input: {} },
    ])
    expect(transcript.toolResults).toEqual([
      {
        toolCallId: "call_1",
        name: "apply_listCards",
        ok: true,
        summary: "Listed your Apply cards",
      },
    ])
    expect(transcript.finishReason).toBe("stop")
    expect(transcript.usage?.tokens).toBe(42)
  })
})
