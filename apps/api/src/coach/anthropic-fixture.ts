import { COACH_MODEL } from "@workspace/domain"
import { createAnthropicModel } from "./anthropic-runtime.js"

export type FixtureChunk = {
  type: string
  id?: string
  finishReason?: unknown
  usage?: unknown
  delta?: string
  toolCallId?: string
  toolName?: string
  input?: string
  chunkDelayInMs?: number
  error?: unknown
}

export function fixtureChunks(input: {
  chunks: FixtureChunk[]
  chunkDelayInMs?: number
}): FixtureChunk[] {
  return input.chunks.map((chunk) => ({
    ...chunk,
    chunkDelayInMs: input.chunkDelayInMs,
  }))
}

export class FixtureCoachModel {
  readonly modelId = COACH_MODEL
  client
  requests: unknown[] = []
  constructor(options: {
    doStream: (request: unknown) => Promise<{ stream: FixtureChunk[] }>
  }) {
    this.client = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async (_url, init) => {
        const request: unknown = JSON.parse(String(init?.body))
        this.requests.push(request)
        const { stream: chunks } = await options.doStream(request)
        const error = chunks.find((chunk) => chunk.type === "error")
        if (error)
          return new Response(
            JSON.stringify({
              type: "error",
              error: {
                type: "api_error",
                message: "synthetic-provider-failure",
              },
            }),
            { status: 500 }
          )
        return anthropicFixtureResponse(chunks)
      },
    }).client
  }
}

export function anthropicFixtureResponse(
  chunks: FixtureChunk[],
  stopReason?: string
): Response {
  const events: unknown[] = [
    {
      type: "message_start",
      message: {
        id: "msg_fixture",
        type: "message",
        role: "assistant",
        model: COACH_MODEL,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    },
  ]
  let index = 0
  for (const chunk of chunks) {
    if (chunk.type === "text-delta") {
      events.push(
        {
          type: "content_block_start",
          index,
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          index,
          delta: { type: "text_delta", text: chunk.delta },
        },
        { type: "content_block_stop", index }
      )
      index++
    }
    if (chunk.type === "tool-call") {
      events.push(
        {
          type: "content_block_start",
          index,
          content_block: {
            type: "tool_use",
            id: chunk.toolCallId,
            name: chunk.toolName,
            input: {},
          },
        },
        {
          type: "content_block_delta",
          index,
          delta: { type: "input_json_delta", partial_json: chunk.input },
        },
        { type: "content_block_stop", index }
      )
      index++
    }
  }
  events.push(
    {
      type: "message_delta",
      delta: {
        stop_reason:
          stopReason ??
          (chunks.some((chunk) => chunk.type === "tool-call")
            ? "tool_use"
            : "end_turn"),
        stop_sequence: null,
      },
      usage: { output_tokens: 1 },
    },
    { type: "message_stop" }
  )
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const event of events) {
          const delay = chunks[0]?.chunkDelayInMs ?? 0
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
          controller.enqueue(
            encoder.encode(
              `event: ${String((event as { type: string }).type)}\ndata: ${JSON.stringify(event)}\n\n`
            )
          )
        }
        controller.close()
      },
    }),
    { headers: { "content-type": "text/event-stream" } }
  )
}
