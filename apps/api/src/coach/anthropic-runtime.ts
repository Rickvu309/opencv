import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod"
import type {
  BetaMessageParam,
  BetaTextBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages"
import {
  COACH_MODEL,
  chatToolNameSchema,
  coachProviderErrorMessage,
  type ChatEntry,
  type CoachMode,
  type CoachStreamPart,
} from "@workspace/domain/coach"
import { type CoachActor } from "@workspace/domain/kernel"

import type { Registry, ToolEntry } from "../registry/registry.js"
import {
  createRequestStepBoundary,
  modelMessageSchema,
  type SerializedStepBoundary,
} from "./model-step.js"
import { toolResultFromExecute } from "./receipt.js"
import { TaskBudgetError } from "./task-budget.js"

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

type JsonRecord = Record<string, unknown>

function jsonRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(label)
  return value as JsonRecord
}

function defsStillUsed(schema: JsonRecord, defs: JsonRecord) {
  const used = new Set<string>()
  const visit = (value: unknown, skipDefs: boolean) => {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      for (const item of value) visit(item, false)
      return
    }
    const record = value as JsonRecord
    const ref = record.$ref
    if (typeof ref === "string" && ref.startsWith("#/$defs/")) {
      const defName = ref.slice("#/$defs/".length)
      if (!used.has(defName) && Object.hasOwn(defs, defName)) {
        used.add(defName)
        visit(defs[defName], false)
      }
    }
    for (const [key, child] of Object.entries(record)) {
      if (skipDefs && key === "$defs") continue
      visit(child, false)
    }
  }
  visit(schema, true)
  const kept: JsonRecord = {}
  for (const defName of used) kept[defName] = defs[defName]
  return kept
}

function advertisedInputSchema(name: string, input: z.ZodType) {
  const schema = jsonRecord(
    z.toJSONSchema(input, { io: "input", reused: "ref" }),
    `Invalid tool schema: ${name}`
  )
  const objectUnion =
    input instanceof z.ZodUnion &&
    input.options.every((option) => option instanceof z.ZodObject)
  if (schema.type !== "object" && !objectUnion)
    throw new Error(`Invalid tool schema: ${name}`)
  if (schema.$defs && typeof schema.$defs === "object") {
    const kept = defsStillUsed(schema, schema.$defs as JsonRecord)
    if (Object.keys(kept).length) schema.$defs = kept
    else delete schema.$defs
  }
  return { ...schema, type: "object" as const }
}

function coachSystem(
  modelId: string,
  stable: string,
  uncached?: string
): string | BetaTextBlockParam[] {
  if (modelId !== "claude-opus-5-5")
    return uncached ? `${stable}\n${uncached}` : stable
  const blocks: BetaTextBlockParam[] = [
    {
      type: "text",
      text: stable,
      cache_control: { type: "ephemeral", ttl: "5m" },
    },
  ]
  if (uncached) blocks.push({ type: "text", text: uncached })
  return blocks
}

export async function* streamAnthropicSteps(input: {
  model: CoachModel
  system: string
  uncached?: string
  history: ChatEntry[]
  messages?: BetaMessageParam[]
  entries: ToolEntry[]
  registry: Pick<Registry, "read" | "execute">
  actor: CoachActor
  signal?: AbortSignal
  mode?: CoachMode
  boundary?: SerializedStepBoundary
  maxSteps?: number
  maxTokens?: number
}): AsyncGenerator<CoachStreamPart> {
  const boundary = input.boundary ?? createRequestStepBoundary(input.signal)
  const pending: CoachStreamPart[] = []
  let toolFailed = false
  const tools = input.entries.map((entry) => {
    const name = chatToolNameSchema.parse(entry.name)
    const schema = advertisedInputSchema(entry.name, entry.input)
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
      input_schema: schema,
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
      max_tokens: input.maxTokens ?? 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: coachSystem(input.model.modelId, input.system, input.uncached),
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
      max_iterations: input.maxSteps ?? 8,
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
      if (message.stop_reason === "max_tokens") {
        if (input.boundary) throw new TaskBudgetError()
        yield {
          type: "error",
          message: "The Coach hit its limit for this turn.",
        }
        return
      }
      const intents = message.content.flatMap((block) => {
        if (block.type !== "tool_use") return []
        const entry = input.entries.find(
          (item) => item.name.replaceAll(".", "_") === block.name
        )
        if (!entry && input.boundary) throw new Error("Unknown model tool")
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
      await boundary.persistStep({
        index: index++,
        intents,
        stopReason: message.stop_reason,
        message: modelMessageSchema.parse({
          role: "assistant",
          content: message.content,
        }),
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheCreationInputTokens:
            message.usage.cache_creation_input_tokens ?? 0,
          cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
        },
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
    if (input.boundary) throw error
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

export function createAnthropicWorkerRuntime(
  input: Omit<
    Parameters<typeof streamAnthropicSteps>[0],
    "messages" | "boundary" | "signal" | "maxSteps" | "maxTokens"
  >
) {
  return (step: Parameters<import("./model-step.js").WorkerRuntime>[0]) =>
    streamAnthropicSteps({
      ...input,
      ...step,
    })
}
