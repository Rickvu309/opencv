import { z } from "zod"
import type { ChatToolName, CoachStreamPart } from "@workspace/domain"

export const modelMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([
    z.string(),
    z.array(
      z.union([
        z.object({ type: z.literal("text"), text: z.string() }),
        z.object({
          type: z.literal("thinking"),
          thinking: z.string(),
          signature: z.string(),
        }),
        z.object({ type: z.literal("redacted_thinking"), data: z.string() }),
        z.object({
          type: z.literal("tool_use"),
          id: z.string(),
          name: z.string(),
          input: z.unknown(),
        }),
        z.object({
          type: z.literal("tool_result"),
          tool_use_id: z.string(),
          content: z.string(),
          is_error: z.boolean().optional(),
        }),
      ])
    ),
  ]),
})
export type ModelMessage = z.infer<typeof modelMessageSchema>
export type WorkerRuntime = (input: {
  messages: ModelMessage[]
  completedSteps: number
  boundary: SerializedStepBoundary
  signal: AbortSignal
  maxSteps: number
  maxTokens: number
}) => AsyncIterable<CoachStreamPart>

export type ModelIntent = {
  id: string
  name: ChatToolName
  input: unknown
}

export type ModelStep = {
  index: number
  intents: readonly ModelIntent[]
  stopReason: string | null
  message?: ModelMessage
  usage?: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens?: number
    cacheReadInputTokens?: number
  }
}

export type StepBoundary = {
  persistStep(step: ModelStep): Promise<void>
  runIntent<T>(intent: ModelIntent, effect: () => Promise<T>): Promise<T>
}

export type SerializedStepBoundary = {
  persistStep(step: ModelStep): Promise<void>
  runIntent(intent: ModelIntent, effect: () => Promise<string>): Promise<string>
}

export function createRequestStepBoundary(signal?: AbortSignal): StepBoundary {
  const decisions = new Map<string, ModelIntent>()
  return {
    async persistStep(step) {
      signal?.throwIfAborted()
      if (step.stopReason === "refusal" || step.stopReason === "max_tokens")
        return
      for (const intent of step.intents) decisions.set(intent.id, intent)
    },
    async runIntent(intent, effect) {
      signal?.throwIfAborted()
      const admitted = decisions.get(intent.id)
      if (
        !admitted ||
        admitted.name !== intent.name ||
        JSON.stringify(admitted.input) !== JSON.stringify(intent.input)
      ) {
        throw new Error("Tool intent has no completed model decision")
      }
      decisions.delete(intent.id)
      return effect()
    },
  }
}

export async function* scriptedSteps(
  parts: AsyncIterable<CoachStreamPart>,
  boundary: StepBoundary
): AsyncGenerator<CoachStreamPart> {
  let index = 0
  for await (const part of parts) {
    if (part.type === "tool-call") {
      await boundary.persistStep({
        index: index++,
        intents: [{ id: part.toolCallId, name: part.name, input: part.input }],
        stopReason: "tool_use",
      })
    }
    yield part
  }
}
