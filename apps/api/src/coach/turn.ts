import {
  appendCoachPart,
  coachActor,
  chatToolNameSchema,
  commandNameSchema,
  deterministicThreadTitle,
  focusedEditNeedsReplace,
  parseChatId,
  parseUserId,
  personActor,
  shouldAutoTitleThread,
  textFromParts,
  type ChatToolName,
  type ChatTurnEvent,
  type CoachActor,
  type CoachFocusDoc,
  type CoachMode,
  type CoachRuntime,
  type CoachSelection,
  type CoachStreamPart,
  type CoachTurnUsage,
  type Plan,
  type ThreadMessage,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"
import {
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
  type ToolSet,
} from "ai"
import type { SSEStreamingApi } from "hono/streaming"

import { readUsage } from "../account/index.js"
import { coachModelEnv } from "../config.js"
import { getChat, insertCoachMessage, trackChatTurn } from "../chat/index.js"
import { registry as defaultRegistry } from "../registry/registry.js"
import type { Registry, ToolEntry } from "../registry/registry.js"
import { toolResultFromExecute } from "./receipt.js"
import { titleFromModel } from "./router.js"
import {
  eventForPart,
  isDisconnected,
  takeUntilAbort,
  waitForAbort,
  writeChatEvent,
  writeHeartbeat,
} from "./sse.js"
import { finishCoachUsage, openCoachUsage } from "./usage-store.js"

const SYSTEM_PROMPT = [
  "You are the opencv Coach.",
  "Help the person with a job search, a CV, or a letter.",
  "Call a tool when you change something. Do not invent a saved edit.",
  "Stages are saved, applied, interview, offer, and closed.",
].join(" ")

export { toolResultFromExecute } from "./receipt.js"

export async function runCoachTurn(options: {
  stream: SSEStreamingApi
  registry?: Registry
  runtime?: CoachRuntime
  model?: LanguageModel
  userId: string
  chatId: string
  mode: CoachMode
  plan: Plan
  provider: string
  modelId: string
  history: ThreadMessage[]
  focusDoc?: CoachFocusDoc
  selection?: CoachSelection
  note?: string
  heartbeatMs: number
  signal?: AbortSignal
}) {
  const startedAt = Date.now()
  const registry = options.registry ?? defaultRegistry
  const actor = coachActor(options.userId, options.chatId)
  const usageId = await openCoachUsage({
    userId: options.userId,
    chatId: options.chatId,
    plan: options.plan,
    mode: options.mode,
    provider: options.runtime ? "fake" : options.provider,
    model: options.runtime ? "fake" : options.modelId,
  })
  const stop = new AbortController()
  const release = trackChatTurn(options.chatId, stop)
  const signal = linkSignals([
    stop.signal,
    ...(options.signal ? [options.signal] : []),
  ])
  let parts: ThreadMessagePart[] = []
  let status: ThreadMessageStatus = "final"
  let usage: CoachTurnUsage = {
    model: options.runtime ? "fake" : options.modelId,
    mode: options.mode,
  }
  const called = new Set<string>()
  const heartbeat = setInterval(() => {
    void writeHeartbeat(options.stream)
  }, options.heartbeatMs)
  const aborted = waitForAbort(options.stream, signal)
  const toolEntries = await registry.tools(actor)

  const emit = (event: ChatTurnEvent) => writeChatEvent(options.stream, event)

  try {
    await emit({ type: "message-start", chatId: options.chatId })
    const iterable = options.runtime
      ? options.runtime.streamTurn({
          userId: options.userId,
          threadId: options.chatId,
          history: options.history,
          model: options.modelId,
          mode: options.mode,
          focusDoc: options.focusDoc,
          selection: options.selection,
          note: options.note,
        })
      : liveParts({
          model: options.model,
          history: options.history,
          registry,
          actor,
          toolEntries,
          focusDoc: options.focusDoc,
          selection: options.selection,
          note: options.note,
        })

    for await (const part of takeUntilAbort(iterable, aborted.promise, () =>
      isDisconnected(options.stream, signal)
    )) {
      if (isDisconnected(options.stream, signal)) {
        status = "aborted"
        break
      }
      if (part.type === "tool-call" || part.type === "tool-result") {
        called.add(part.name)
      }
      parts = appendCoachPart(parts, part)
      if (part.type === "finish") {
        usage = {
          model: part.usage.model || usage.model,
          mode: options.mode,
          finishReason: part.finishReason,
          latencyMs: part.usage.latencyMs,
        }
        break
      }
      if (part.type === "error") {
        status = "error"
        await emit({ type: "error", message: part.message })
        break
      }
      if (part.type === "tool-call") {
        const entry = toolEntries.find((item) => item.name === part.name)
        if (entry) await emit({ type: "step", label: entry.step(part.input) })
      }
      const event = eventForPart(part)
      if (event) await emit(event)
      if (part.type === "tool-result" && part.pendingActionId && part.command) {
        await emit({
          type: "confirm",
          pendingActionId: part.pendingActionId,
          command: commandNameSchema.parse(part.command),
          summary: part.summary,
        })
      }
    }

    const asked = askedForEdit(options.history, options.selection)
    if (
      !options.runtime &&
      focusedEditNeedsReplace({
        mode: options.mode,
        focusKind: options.focusDoc ? "paper" : null,
        askedForEdit: asked,
        calledReplace: called.has("paper.replace"),
      })
    ) {
      status = "error"
      await emit({
        type: "error",
        message:
          "The edit did not save. Ask again and I will update the document.",
      })
    }
  } catch (error) {
    if (isDisconnected(options.stream, signal)) {
      status = "aborted"
    } else {
      status = "error"
      const message =
        error instanceof Error ? error.message : "The Coach stopped."
      await emit({ type: "error", message })
    }
  } finally {
    clearInterval(heartbeat)
    aborted.dispose()
    release()
    if (isDisconnected(options.stream, signal) && status === "final") {
      status = "aborted"
    }
    const workedMs = Math.max(0, Date.now() - startedAt)
    const saved = await insertCoachMessage({
      chatId: parseChatId(options.chatId),
      userId: parseUserId(options.userId),
      text: textFromParts(parts),
      parts,
      status,
      workedMs,
    })
    await finishCoachUsage({
      id: usageId,
      messageId: saved.id,
      finishReason: usage.finishReason ?? status,
      latencyMs: workedMs,
    })
    await maybeTitle({
      registry,
      userId: options.userId,
      chatId: options.chatId,
      coachText: textFromParts(parts),
      status,
      currentMessageId: saved.id,
      plan: options.plan,
      runtime: Boolean(options.runtime),
    })
    if (!isDisconnected(options.stream, signal)) {
      const snapshot = await readUsage(options.userId).catch(() => null)
      await emit({
        type: "usage",
        plan: options.plan,
        mode: options.mode,
        capped: snapshot?.day.capped ?? false,
      })
      await emit({ type: "message-end", chatId: options.chatId })
    }
  }
}

function linkSignals(signals: AbortSignal[]) {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true })
  }
  return controller.signal
}

function askedForEdit(history: ThreadMessage[], selection?: CoachSelection) {
  if (selection?.text) return true
  const text =
    [...history].reverse().find((message) => message.role === "user")?.text ??
    ""
  return /\b(edit|rewrite|tailor|shorten|fix|update)\b/i.test(text)
}

async function maybeTitle(input: {
  registry: Registry
  userId: string
  chatId: string
  coachText: string
  status: string
  currentMessageId: string
  plan: Plan
  runtime: boolean
}) {
  const chat = await getChat(
    parseUserId(input.userId),
    parseChatId(input.chatId)
  )
  const messages = chat.messages
    .filter((message) => message.id !== input.currentMessageId)
    .map((message) => ({
      role: message.role === "person" ? ("user" as const) : ("coach" as const),
      text: message.text,
      status: message.status ?? undefined,
    }))
  const decision = shouldAutoTitleThread({
    currentTitle: chat.title,
    messages,
    status: input.status,
  })
  if (!decision) return
  let title = deterministicThreadTitle({
    userText: decision.userText,
    coachText: input.coachText,
  })
  if (!input.runtime) {
    try {
      const generated = await titleFromModel({
        plan: input.plan,
        userText: decision.userText,
        coachText: input.coachText,
        env: coachModelEnv(),
      })
      if (generated) title = generated
    } catch {
      // A missing key keeps the deterministic title and does not open a usage row.
    }
  }
  if (!title || title === chat.title) return
  await input.registry.execute({
    name: "chat.rename",
    input: { chatId: input.chatId, title },
    actor: personActor(input.userId),
  })
}

async function* liveParts(input: {
  model?: LanguageModel
  history: ThreadMessage[]
  registry: Registry
  actor: CoachActor
  toolEntries: ToolEntry[]
  focusDoc?: CoachFocusDoc
  selection?: CoachSelection
  note?: string
}): AsyncGenerator<CoachStreamPart> {
  if (!input.model) {
    yield { type: "error", message: "The Coach is unavailable right now" }
    return
  }
  const tools: ToolSet = {}
  // Model providers reject dots in tool names, so the model sees `paper_replace`; everything past this function sees `paper.replace`.
  const registryName = new Map<string, ChatToolName>()
  for (const entry of input.toolEntries) {
    const name = entry.name.replaceAll(".", "_")
    registryName.set(name, chatToolNameSchema.parse(entry.name))
    tools[name] = tool({
      description: entry.description,
      inputSchema: entry.input,
      execute: async (args) => {
        if (entry.kind === "query") {
          const data = await input.registry.read(entry.name, args, input.actor)
          return { ok: true, summary: entry.step(args), data }
        }
        const result = await input.registry.execute({
          name: entry.name,
          input: args,
          actor: input.actor,
        })
        return {
          ok: true,
          pending: result.pending,
          pendingActionId: result.pendingActionId,
          command: result.command ?? entry.name,
          summary: result.summary ?? entry.step(args),
          output: result.output,
          activityId: result.activityId,
          reversal: result.reversal,
        }
      },
    })
  }
  const focus = input.focusDoc
    ? `The open document is ${input.focusDoc.name} (${input.focusDoc.kind}).`
    : ""
  const note = input.note ?? ""
  const result = streamText({
    model: input.model,
    system: `${SYSTEM_PROMPT} ${focus} ${note}`.trim(),
    messages: input.history.map((message) => ({
      role:
        message.role === "coach" ? ("assistant" as const) : ("user" as const),
      content: message.text,
    })),
    tools,
    stopWhen: stepCountIs(8),
  })
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      const delta = "text" in part ? part.text : ""
      if (delta) yield { type: "text-delta", text: delta }
      continue
    }
    if (part.type === "tool-call") {
      yield {
        type: "tool-call",
        toolCallId: part.toolCallId,
        name:
          registryName.get(part.toolName) ??
          chatToolNameSchema.parse(part.toolName),
        input: part.input,
      }
      continue
    }
    if (part.type === "tool-result") {
      const output = record(part.output)
      const name =
        registryName.get(part.toolName) ??
        chatToolNameSchema.parse(part.toolName)
      yield toolResultFromExecute({
        toolCallId: part.toolCallId,
        name,
        summary: textField(output?.summary) || name,
        result: {
          pending: output?.pending === true,
          pendingActionId: textField(output?.pendingActionId) || undefined,
          command: textField(output?.command) || name,
          summary: textField(output?.summary) || name,
          output: output?.data ?? output?.output,
          activityId: textField(output?.activityId) || null,
          reversal: reversalPlan(output?.reversal),
        },
      })
    }
  }
  yield {
    type: "finish",
    finishReason: "stop",
    usage: { model: "routed", finishReason: "stop" },
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function textField(value: unknown) {
  return typeof value === "string" ? value : ""
}

function reversalPlan(value: unknown) {
  const row = record(value)
  if (!row || typeof row.command !== "string") return null
  return { command: row.command, input: row.input }
}
