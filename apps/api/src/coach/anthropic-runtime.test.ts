import { COACH_MODEL, type CoachStreamPart } from "@workspace/domain/coach"
import { coachActor, personActor } from "@workspace/domain/kernel"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { installRegistry } from "../install.js"
import type { ToolEntry } from "../registry/registry.js"
import { anthropicFixtureResponse } from "./anthropic-fixture.js"
import {
  completeAnthropic,
  createAnthropicModel,
  streamAnthropicSteps,
} from "./anthropic-runtime.js"
import { createRequestStepBoundary, type ModelStep } from "./model-step.js"

const entry: ToolEntry = {
  name: "job.list",
  description: "List Jobs",
  kind: "query",
  coach: true,
  destructive: false,
  input: z.object({ limit: z.number().optional() }),
  step: () => "List Jobs",
}
const actor = coachActor("user", "00000000-0000-4000-8000-000000000001", "turn")

async function collect(stream: AsyncIterable<CoachStreamPart>) {
  const parts: CoachStreamPart[] = []
  for await (const part of stream) parts.push(part)
  return parts
}

function fixture(responses: (() => Response | Promise<Response>)[]) {
  const requests: Record<string, unknown>[] = []
  const model = createAnthropicModel({
    apiKey: "fixture",
    maxRetries: 0,
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      const next = responses.shift()
      if (!next) throw new Error("Unexpected model request")
      return next()
    },
  })
  return { model, requests }
}

const text = () =>
  anthropicFixtureResponse([{ type: "text-delta", delta: "Done." }])
const calls = (input = "{}") =>
  anthropicFixtureResponse([
    { type: "text-delta", delta: "Checking. " },
    { type: "tool-call", toolCallId: "call_a", toolName: "job_list", input },
    { type: "tool-call", toolCallId: "call_b", toolName: "job_list", input },
  ])

describe("Anthropic request-bound Coach runtime", () => {
  it("streams text and persists a complete decision before multiple effects and continues with their results", async () => {
    const { model, requests } = fixture([calls, text])
    const steps: ModelStep[] = []
    const boundary = createRequestStepBoundary()
    const read = vi.fn(async () => {
      expect(steps[0]?.intents.map((intent) => intent.id)).toEqual([
        "call_a",
        "call_b",
      ])
      return []
    })
    const parts = await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "Grounded",
        entries: [entry],
        actor,
        registry: { read, execute: vi.fn() },
        boundary: {
          ...boundary,
          persistStep: async (step) => {
            steps.push(step)
            await boundary.persistStep(step)
          },
        },
      })
    )
    expect(parts.filter((part) => part.type === "tool-result")).toHaveLength(2)
    expect(parts.at(-1)).toMatchObject({
      type: "finish",
      usage: { model: COACH_MODEL },
    })
    expect(read).toHaveBeenCalledTimes(2)
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      model: COACH_MODEL,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tool_choice: { type: "auto" },
      tools: [
        {
          name: "job_list",
          eager_input_streaming: true,
          input_schema: { type: "object" },
        },
      ],
    })
    for (const key of ["temperature", "top_p", "top_k"])
      expect(requests[0]).not.toHaveProperty(key)
    expect(JSON.stringify(requests[1]?.messages)).toContain(
      '"tool_use_id":"call_a"'
    )
  })

  it("keeps approval metadata in the tool result returned to the model", async () => {
    const command: ToolEntry = { ...entry, name: "paper.edit", kind: "command" }
    const { model, requests } = fixture([
      () =>
        anthropicFixtureResponse([
          {
            type: "tool-call",
            toolCallId: "proposal",
            toolName: "paper_edit",
            input: "{}",
          },
        ]),
      text,
    ])
    const execute = vi.fn(async () => ({
      pending: true,
      pendingActionId: "approval",
      command: "paper.edit",
      summary: "Approve this edit",
      output: null,
      activityId: null,
      reversal: null,
    }))
    const parts = await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "",
        entries: [command],
        actor,
        registry: { read: vi.fn(), execute },
      })
    )
    expect(execute).toHaveBeenCalledTimes(1)
    expect(parts).toContainEqual(
      expect.objectContaining({
        type: "tool-result",
        pendingActionId: "approval",
      })
    )
    expect(JSON.stringify(requests[1]?.messages)).toContain("pendingActionId")
    expect(JSON.stringify(requests[1]?.messages)).toContain("Approve this edit")
  })

  it("rejects an unknown tool before saving a durable decision or running an effect", async () => {
    const { model } = fixture([
      () =>
        anthropicFixtureResponse([
          {
            type: "tool-call",
            toolCallId: "unknown",
            toolName: "paper_replace",
            input: "{}",
          },
        ]),
    ])
    const read = vi.fn()
    const execute = vi.fn()
    const persistStep = vi.fn()
    const runIntent = vi.fn()
    await expect(
      collect(
        streamAnthropicSteps({
          model,
          history: [],
          system: "",
          entries: [],
          actor,
          registry: { read, execute },
          boundary: { persistStep, runIntent },
        })
      )
    ).rejects.toThrow("Unknown model tool")
    expect(read).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
    expect(persistStep).not.toHaveBeenCalled()
    expect(runIntent).not.toHaveBeenCalled()
  })

  it("validates eager tool input before any read or command", async () => {
    const { model } = fixture([() => calls('{"limit":"wrong"}')])
    const read = vi.fn()
    const execute = vi.fn()
    const parts = await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "",
        entries: [entry],
        actor,
        registry: { read, execute },
      })
    )
    expect(read).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
    expect(parts.at(-1)?.type).toBe("error")
  })

  it("does not run tools after refusal or truncated input", async () => {
    for (const reason of ["refusal", "max_tokens"]) {
      const { model } = fixture([
        () =>
          anthropicFixtureResponse(
            [
              {
                type: "tool-call",
                toolCallId: "call",
                toolName: "job_list",
                input: "{}",
              },
            ],
            reason
          ),
      ])
      const read = vi.fn()
      const parts = await collect(
        streamAnthropicSteps({
          model,
          history: [],
          system: "",
          entries: [entry],
          actor,
          registry: { read, execute: vi.fn() },
        })
      )
      expect(read).not.toHaveBeenCalled()
      expect(parts.at(-1)?.type).toBe("error")
    }
  })

  it("surfaces registry denial without claiming an action succeeded", async () => {
    const { model } = fixture([calls])
    const parts = await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "",
        entries: [entry],
        actor,
        registry: {
          read: vi.fn(async () => {
            throw new Error("Denied")
          }),
          execute: vi.fn(),
        },
      })
    )
    expect(parts.filter((part) => part.type === "tool-result")).toEqual([])
    expect(parts.at(-1)?.type).toBe("error")
  })

  it("aborts the HTTP stream and performs no tools", async () => {
    const stop = new AbortController()
    const model = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async (_url, init) => {
        const signal = init?.signal
        return new Response(
          new ReadableStream({
            start(controller) {
              signal?.addEventListener(
                "abort",
                () => controller.error(new Error("Aborted")),
                { once: true }
              )
              stop.abort()
            },
          }),
          { headers: { "content-type": "text/event-stream" } }
        )
      },
    })
    const read = vi.fn()
    await expect(
      collect(
        streamAnthropicSteps({
          model,
          history: [],
          system: "",
          entries: [entry],
          actor,
          registry: { read, execute: vi.fn() },
          signal: stop.signal,
        })
      )
    ).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })

  it("continues from restored tool results without replaying their effects and offers no tools for regeneration", async () => {
    const { model, requests } = fixture([text])
    const read = vi.fn()
    await collect(
      streamAnthropicSteps({
        model,
        history: [],
        messages: [
          { role: "user", content: "Find Jobs" },
          {
            role: "assistant",
            content: [
              { type: "tool_use", id: "saved", name: "job_list", input: {} },
            ],
          },
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "saved", content: "[]" },
            ],
          },
        ],
        system: "",
        entries: [],
        actor,
        registry: { read, execute: vi.fn() },
      })
    )
    expect(read).not.toHaveBeenCalled()
    expect(requests[0]?.tools).toEqual([])
    expect(JSON.stringify(requests[0]?.messages)).toContain(
      '"tool_use_id":"saved"'
    )
  })

  it("compiles all registry schemas including Paper edit unions", async () => {
    const { model, requests } = fixture([text])
    const registry = installRegistry()
    const entries = await registry.tools(personActor("user"))
    await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "",
        entries,
        actor,
        registry,
      })
    )
    expect(requests).toHaveLength(1)
    expect(requests[0]?.tools).toHaveLength(entries.length)
    expect(requests[0]?.tools).toContainEqual(
      expect.objectContaining({
        name: "paper_save",
        input_schema: expect.objectContaining({
          type: "object",
          required: ["docId", "client", "base", "changes"],
          additionalProperties: false,
        }),
      })
    )
  })

  it("uses bounded Anthropic Messages for posting completion", async () => {
    let observed: unknown
    const model = createAnthropicModel({
      apiKey: "fixture",
      fetch: async (_url, init) => {
        observed = JSON.parse(String(init?.body))
        return Response.json({
          id: "msg",
          type: "message",
          role: "assistant",
          model: COACH_MODEL,
          content: [{ type: "text", text: "{}" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        })
      },
    })
    expect(await completeAnthropic(model, "Posting")).toBe("{}")
    expect(observed).toMatchObject({
      model: COACH_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
    })
    expect(JSON.stringify(observed)).not.toContain("cache_control")
  })

  it("rejects a completion that thinking used up before any answer", async () => {
    const model = createAnthropicModel({
      apiKey: "fixture",
      fetch: async () =>
        Response.json({
          id: "msg",
          type: "message",
          role: "assistant",
          model: COACH_MODEL,
          content: [{ type: "thinking", thinking: "", signature: "sig" }],
          stop_reason: "max_tokens",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 8000 },
        }),
    })
    await expect(completeAnthropic(model, "Posting")).rejects.toThrow("cut off")
  })

  it("does not save a cut-off reply as final", async () => {
    const { model } = fixture([
      () =>
        anthropicFixtureResponse(
          [{ type: "text-delta", delta: "Here is half of a dra" }],
          "max_tokens"
        ),
    ])
    const parts = await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "",
        entries: [entry],
        actor,
        registry: { read: vi.fn(), execute: vi.fn() },
      })
    )
    expect(parts.at(-1)).toEqual({
      type: "error",
      message: "The Coach hit its limit for this turn.",
    })
    expect(parts.some((part) => part.type === "finish")).toBe(false)
  })

  it("treats a cut-off tool call as the limit before reading its input", async () => {
    const strict: ToolEntry = {
      ...entry,
      name: "paper.edit",
      kind: "command",
      input: z.object({
        docId: z.string(),
        basedOn: z.number(),
        edits: z.array(z.unknown()),
      }),
    }
    const { model } = fixture([
      () =>
        anthropicFixtureResponse(
          [
            {
              type: "tool-call",
              toolCallId: "cut",
              toolName: "paper_edit",
              input: "{}",
            },
          ],
          "max_tokens"
        ),
    ])
    const execute = vi.fn()
    const parts = await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "",
        entries: [strict],
        actor,
        registry: { read: vi.fn(), execute },
      })
    )
    expect(execute).not.toHaveBeenCalled()
    expect(parts.at(-1)).toEqual({
      type: "error",
      message: "The Coach hit its limit for this turn.",
    })
    expect(parts.some((part) => part.type === "finish")).toBe(false)
  })

  it("reuses shared instructions for five minutes and leaves a person's page out", async () => {
    const secret = "doc-secret-9f3a"
    const { model, requests } = fixture([text])
    await collect(
      streamAnthropicSteps({
        model,
        history: [
          {
            id: "00000000-0000-4000-8000-000000000010",
            role: "user",
            text: "Please look at my page",
            createdAt: "2026-11-10T00:00:00.000Z",
          },
        ],
        system: "Shared instructions",
        uncached: `Context: ${secret}`,
        entries: [entry],
        actor,
        registry: { read: vi.fn(), execute: vi.fn() },
      })
    )
    const request = requests[0] as {
      system: {
        type: string
        text: string
        cache_control?: { type: string; ttl: string }
      }[]
      tools: { cache_control?: unknown }[]
      messages: unknown[]
    }
    expect(request.system[0]).toEqual({
      type: "text",
      text: "Shared instructions",
      cache_control: { type: "ephemeral", ttl: "5m" },
    })
    expect(request.system[0]?.text).not.toContain(secret)
    expect(request.system[1]).toEqual({
      type: "text",
      text: `Context: ${secret}`,
    })
    expect(request.system[1]).not.toHaveProperty("cache_control")
    expect(request.tools.length).toBeGreaterThan(0)
    expect(JSON.stringify(request.tools)).not.toContain("cache_control")
    expect(JSON.stringify(request.messages)).toContain("Please look at my page")
    expect(JSON.stringify(request.messages)).not.toContain("cache_control")
    expect(JSON.stringify(request).match(/cache_control/g)).toHaveLength(1)
  })

  it("records a fresh copy, a later copy, and the uncached remainder", async () => {
    const { model } = fixture([
      () =>
        anthropicFixtureResponse(
          [{ type: "text-delta", delta: "Ok" }],
          "end_turn",
          {
            inputTokens: 40,
            outputTokens: 2,
            cacheCreationInputTokens: 17000,
            cacheReadInputTokens: 0,
          }
        ),
    ])
    const steps: ModelStep[] = []
    await collect(
      streamAnthropicSteps({
        model,
        history: [],
        system: "Shared instructions",
        entries: [entry],
        actor,
        registry: { read: vi.fn(), execute: vi.fn() },
        boundary: {
          persistStep: async (step) => {
            steps.push(step)
          },
          runIntent: async () => "",
        },
      })
    )
    expect(steps[0]?.usage).toEqual({
      inputTokens: 40,
      outputTokens: 2,
      cacheCreationInputTokens: 17000,
      cacheReadInputTokens: 0,
    })
  })

  it("does not reuse instructions for a different model", async () => {
    const { model, requests } = fixture([text])
    await collect(
      streamAnthropicSteps({
        model: { ...model, modelId: "claude-other" as typeof model.modelId },
        history: [],
        system: "Shared instructions",
        uncached: "Context: doc-secret-9f3a",
        entries: [entry],
        actor,
        registry: { read: vi.fn(), execute: vi.fn() },
      })
    )
    expect(requests[0]?.system).toBe(
      "Shared instructions\nContext: doc-secret-9f3a"
    )
    expect(JSON.stringify(requests[0])).not.toContain("cache_control")
  })
})
