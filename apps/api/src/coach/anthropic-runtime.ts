import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod"
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages"
import {
  COACH_MODEL,
  chatToolNameSchema,
  coachProviderErrorMessage,
  type ChatEntry,
  type CoachActor,
  type CoachMode,
  type CoachStreamPart,
} from "@workspace/domain"

import type { Registry, ToolEntry } from "../registry/registry.js"
import { createRequestStepBoundary, type StepBoundary } from "./model-step.js"
import { toolResultFromExecute } from "./receipt.js"

export type CoachModel = { client: Anthropic; modelId: typeof COACH_MODEL }

export function createAnthropicModel(
  options: ConstructorParameters<typeof Anthropic>[0]
): CoachModel {
  return {
    client: new Anthropic({ maxRetries: 1, timeout: 120_000, ...options }),
    modelId: COACH_MODEL,
  }
}

export async function completeAnthropic(
  model: CoachModel,
  prompt: string
): Promise<string> {
  const message = await model.client.messages.create(
    {
      model: model.modelId,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: 10_000, maxRetries: 0 }
  )
  if (message.stop_reason === "refusal")
    throw new Error("The Coach declined this request")
  if (message.stop_reason === "max_tokens")
    throw new Error("The Coach reply was cut off before it finished")
  return message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
}

export async function* streamAnthropicSteps(input: {
  model: CoachModel
  system: string
  history: ChatEntry[]
  messages?: BetaMessageParam[]
  entries: ToolEntry[]
  registry: Pick<Registry, "read" | "execute">
  actor: CoachActor
  signal?: AbortSignal
  mode?: CoachMode
  boundary?: StepBoundary
}): AsyncGenerator<CoachStreamPart> {
  const boundary = input.boundary ?? createRequestStepBoundary(input.signal)
  const pending: CoachStreamPart[] = []
  let toolFailed = false
  const tools = input.entries.map((entry) => {
    const name = chatToolNameSchema.parse(entry.name)
    const schema = z.toJSONSchema(entry.input, { io: "input", reused: "ref" })
    if (schema.type !== "object")
      throw new Error(`Invalid tool schema: ${name}`)
    const tool = betaZodTool({
      name: name.replaceAll(".", "_"),
      description: entry.description,
      inputSchema: z.object({}).passthrough(),
      eager_input_streaming: true,
      run: async (args, context) => {
        if (!context) throw new Error("Missing tool identity")
        const intent = { id: context.toolUse.id, name, input: args }
        try {
          return await boundary.runIntent(intent, async () => {
            context.signal?.throwIfAborted()
            const parsed = entry.input.parse(args)
            const result: Parameters<
              typeof toolResultFromExecute
            >[0]["result"] =
              entry.kind === "query"
                ? {
                    pending: false,
                    output: await input.registry.read(
                      entry.name,
                      parsed,
                      input.actor
                    ),
                    activityId: null,
                    reversal: null,
                  }
                : await input.registry.execute({
                    name: entry.name,
                    input: parsed,
                    actor: input.actor,
                  })
            const part = toolResultFromExecute({
              toolCallId: intent.id,
              name,
              summary: entry.step(parsed),
              result,
            })
            pending.push(part)
            return JSON.stringify({
              ...part.result,
              pending: result.pending,
              pendingActionId: result.pendingActionId,
              summary: part.summary,
              command: result.command,
              activityId: result.activityId,
              reversal: result.reversal,
            })
          })
        } catch (error) {
          toolFailed = true
          throw error
        }
      },
    })
    return {
      ...tool,
      input_schema: { ...schema, type: "object" as const },
      parse: (args: unknown) => entry.input.parse(args),
    }
  })
  const idle = new AbortController()
  let idleTimer = setTimeout(() => idle.abort(), 30_000)
  const signal = AbortSignal.any([
    idle.signal,
    AbortSignal.timeout(120_000),
    ...(input.signal ? [input.signal] : []),
  ])
  const runner = input.model.client.beta.messages.toolRunner(
    {
      model: input.model.modelId,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: input.system,
      messages:
        input.messages ??
        input.history.slice(-40).map((message) => ({
          role: message.role === "coach" ? "assistant" : "user",
          content: message.text,
        })),
      tools,
      tool_choice: { type: "auto" },
      stream: true,
      thread: false,
      runToolsEagerly: false,
      max_iterations: 8,
    },
    { signal }
  )
  let modelId: string = input.model.modelId
  let finishReason = "stop"
  let index = 0
  try {
    for await (const stream of runner) {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => idle.abort(), 30_000)
      for (const part of pending.splice(0)) yield part
      if (toolFailed) throw new Error("Tool execution failed")
      for await (const event of stream) {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => idle.abort(), 30_000)
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        )
          yield { type: "text-delta", text: event.delta.text }
      }
      clearTimeout(idleTimer)
      const message = await stream.finalMessage()
      modelId = message.model
      finishReason =
        message.stop_reason === "end_turn"
          ? "stop"
          : (message.stop_reason ?? "stop")
      const intents = message.content.flatMap((block) => {
        if (block.type !== "tool_use") return []
        const entry = input.entries.find(
          (item) => item.name.replaceAll(".", "_") === block.name
        )
        return entry
          ? [
              {
                id: block.id,
                name: chatToolNameSchema.parse(entry.name),
                input: entry.input.parse(block.input),
              },
            ]
          : []
      })
      if (message.stop_reason === "refusal") {
        yield {
          type: "error",
          message: "The Coach declined this request. Try rephrasing it.",
        }
        return
      }
      if (message.stop_reason === "max_tokens") {
        yield {
          type: "error",
          message: "The Coach reply was cut off before it finished. Try again.",
        }
        return
      }
      await boundary.persistStep({
        index: index++,
        intents,
        stopReason: message.stop_reason,
      })
      for (const intent of intents)
        yield {
          type: "tool-call",
          toolCallId: intent.id,
          name: intent.name,
          input: intent.input,
        }
      const response = await runner.generateToolResponse()
      for (const part of pending.splice(0)) yield part
      if (
        toolFailed ||
        (Array.isArray(response?.content) &&
          response.content.some(
            (block) =>
              block.type === "tool_result" &&
              block.is_error &&
              intents.some((intent) => intent.id === block.tool_use_id)
          ))
      ) {
        yield {
          type: "error",
          message:
            "The action did not complete. Check the document or job before trying again.",
        }
        return
      }
    }
    for (const part of pending.splice(0)) yield part
    if (toolFailed) throw new Error("Tool execution failed")
    yield {
      type: "finish",
      finishReason,
      usage: { model: modelId, finishReason },
    }
  } catch (error) {
    input.signal?.throwIfAborted()
    const message = coachProviderErrorMessage(error, input.mode)
    yield {
      type: "error",
      message: /limit|quota|available/.test(message)
        ? message
        : "The Coach could not finish. Try again in a moment.",
    }
  } finally {
    clearTimeout(idleTimer)
  }
}
