import type { ChatToolName, CoachStreamPart } from "@workspace/domain"

export type ModelIntent = {
  id: string
  name: ChatToolName
  input: unknown
}

export type ModelStep = {
  index: number
  intents: readonly ModelIntent[]
  stopReason: string | null
}

export type StepBoundary = {
  persistStep(step: ModelStep): Promise<void>
  runIntent<T>(intent: ModelIntent, effect: () => Promise<T>): Promise<T>
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
