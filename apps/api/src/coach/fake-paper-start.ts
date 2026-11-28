import { type ChatToolName } from "@workspace/domain/coach"
import { catalog } from "@workspace/domain/kernel"
import { z } from "zod"

import { fakePaperEdit } from "./fake.js"
import type { ModelMessage, WorkerRuntime } from "./model-step.js"

const START_ASK = /^\s*(?:make|create|start)\b[^.?!]*?\b(cv|letter)\b/i

const startedSchema = z.object({
  output: z.object({ docId: z.string() }),
})

const outlinedSchema = z.object({
  output: z.object({
    revision: z.number(),
    outline: z.string(),
  }),
})

type StartKind = "cv" | "letter"

function textOf(message: ModelMessage) {
  if (typeof message.content === "string") return message.content
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

export function paperStartAsk(messages: readonly ModelMessage[]) {
  const asked = [...messages]
    .reverse()
    .find((message) => message.role === "user" && textOf(message).trim())
  const match = asked ? START_ASK.exec(textOf(asked)) : null
  return match ? (match[1]!.toLowerCase() as StartKind) : null
}

function toolResults(messages: readonly ModelMessage[]) {
  return messages.flatMap((message) =>
    typeof message.content === "string"
      ? []
      : message.content.flatMap((part) =>
          part.type === "tool_result" ? [part.content] : []
        )
  )
}

function latest<T>(results: readonly string[], schema: z.ZodType<T>) {
  for (const result of [...results].reverse()) {
    let value: unknown
    try {
      value = JSON.parse(result)
    } catch {
      continue
    }
    const parsed = schema.safeParse(value)
    if (parsed.success) return parsed.data
  }
  throw new Error("The fake Coach lost the page it started")
}

function decide(
  step: number,
  kind: StartKind,
  jobId: string | undefined,
  results: readonly string[]
): {
  text: string
  intents: { id: string; name: ChatToolName; input: unknown }[]
} {
  if (step === 0)
    return {
      text: `I started your ${kind === "cv" ? "CV" : "letter"}. `,
      intents: [
        {
          id: "call_start",
          name: catalog["paper.start"].name,
          input: { kind, ...(jobId ? { jobId } : {}) },
        },
      ],
    }
  const docId = latest(results, startedSchema).output.docId
  if (step === 1)
    return {
      text: "",
      intents: [
        {
          id: "call_outline",
          name: catalog["paper.outline"].name,
          input: { docId },
        },
      ],
    }
  if (step === 2) {
    const outlined = latest(results, outlinedSchema).output
    return {
      text: "",
      intents: [
        {
          id: "call_edit",
          name: catalog["paper.edit"].name,
          input: fakePaperEdit({
            id: docId,
            revision: outlined.revision,
            outline: outlined.outline,
          }),
        },
      ],
    }
  }
  return { text: "I proposed one edit for you to approve.", intents: [] }
}

export function paperStartRuntime(
  kind: StartKind,
  jobId: string | undefined
): WorkerRuntime {
  return async function* (input) {
    const results = toolResults(input.messages)
    for (
      let step = input.completedSteps;
      step < input.completedSteps + input.maxSteps;
      step++
    ) {
      input.signal.throwIfAborted()
      const decision = decide(step, kind, jobId, results)
      if (decision.text) yield { type: "text-delta", text: decision.text }
      await input.boundary.persistStep({
        index: step - input.completedSteps,
        intents: decision.intents,
        stopReason: decision.intents.length ? "tool_use" : "end_turn",
        usage: { inputTokens: 10, outputTokens: 10 },
        message: {
          role: "assistant",
          content: [
            { type: "text", text: decision.text },
            ...decision.intents.map((intent) => ({
              type: "tool_use" as const,
              id: intent.id,
              name: intent.name.replaceAll(".", "_"),
              input: intent.input,
            })),
          ],
        },
      })
      for (const intent of decision.intents)
        results.push(
          await input.boundary.runIntent(intent, async () => {
            throw new Error("The fake Coach attempted an unsaved effect")
          })
        )
      if (!decision.intents.length) return
    }
  }
}
