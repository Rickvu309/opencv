import {
  COACH_SSE_EVENTS,
  appendCoachPart,
  deterministicThreadTitle,
  focusedEditNeedsReplace,
  shouldAutoTitleThread,
  textFromParts,
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
import { stepCountIs, streamText, tool, type LanguageModel, type ToolSet } from "ai"
import type { SSEStreamingApi } from "hono/streaming"

import { getChat, insertCoachMessage, renameChat, trackChatTurn } from "../chat/index.js"
import { registry as defaultRegistry } from "../registry/registry.js"
import type { Registry } from "../registry/registry.js"
import {
  isDisconnected,
  sseDataForPart,
  takeUntilAbort,
  waitForAbort,
  writeEvent,
  writeHeartbeat,
} from "./sse.js"
import { finishCoachUsage, openCoachUsage } from "./usage-store.js"

const SYSTEM_PROMPT = [
  "You are the opencv Coach.",
  "Help the person with a job search, a CV, or a letter.",
  "Call a tool when you change something. Do not invent a saved edit.",
  "Stages are saved, applied, interview, offer, and closed.",
].join(" ")

export async function runCoachTurn(options: {
  stream: SSEStreamingApi
  wire: "compat" | "native"
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
  heartbeatMs: number
  signal?: AbortSignal
}) {
  const startedAt = Date.now()
  const registry = options.registry ?? defaultRegistry
  const actor = {
    type: "coach" as const,
    userId: options.userId,
    chatId: options.chatId,
  }
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

  const emit = async (event: string, data: unknown) => {
    await writeEvent(options.stream, event, data)
  }

  try {
    await emit(
      COACH_SSE_EVENTS.messageStart,
      options.wire === "compat"
        ? { threadId: options.chatId }
        : { chatId: options.chatId }
    )
    const iterable = options.runtime
      ? options.runtime.streamTurn({
          userId: options.userId,
          threadId: options.chatId,
          history: options.history,
          model: options.modelId,
          mode: options.mode,
          focusDoc: options.focusDoc,
          selection: options.selection,
        })
      : liveParts({
          model: options.model,
          history: options.history,
          registry,
          actor,
          focusDoc: options.focusDoc,
          selection: options.selection,
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
        await emit(COACH_SSE_EVENTS.error, { message: part.message })
        break
      }
      if (part.type === "tool-call" && options.wire === "native") {
        const entry = registry.tools(actor).find(
          (item) => item.name === part.name || item.name.replaceAll(".", "_") === part.name
        )
        if (entry) await emit("step", { label: entry.step(part.input) })
      }
      if (
        part.type === "text-delta" ||
        part.type === "tool-call" ||
        part.type === "tool-result"
      ) {
        await emit(part.type, sseDataForPart(part))
      }
    }

    const asked = askedForEdit(options.history, options.selection)
    if (
      !options.runtime &&
      focusedEditNeedsReplace({
        mode: options.mode,
        focusKind: options.focusDoc ? "paper" : null,
        askedForEdit: asked,
        calledReplace:
          called.has("paper.replace") || called.has("paper_replace"),
      })
    ) {
      status = "error"
      await emit(COACH_SSE_EVENTS.error, {
        message: "The edit did not save. Ask again and I will update the document.",
      })
    }
  } catch (error) {
    if (isDisconnected(options.stream, signal)) {
      status = "aborted"
    } else {
      status = "error"
      const message = error instanceof Error ? error.message : "The Coach stopped."
      await emit(COACH_SSE_EVENTS.error, { message })
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
      chatId: options.chatId,
      userId: options.userId,
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
    await maybeTitle(
      options.userId,
      options.chatId,
      textFromParts(parts),
      status,
      saved.id
    )
    if (!isDisconnected(options.stream, signal)) {
      const message = {
        id: saved.id,
        role: "coach" as const,
        text: saved.text,
        createdAt: saved.createdAt,
        parts,
        status,
        workedMs,
        rating: null,
      }
      if (options.wire === "compat") {
        await emit(COACH_SSE_EVENTS.messageEnd, {
          message,
          usage: { ...usage, latencyMs: workedMs, mode: options.mode },
        })
      } else {
        await emit("usage", {
          plan: options.plan,
          mode: options.mode,
          capped: true,
        })
        await emit(COACH_SSE_EVENTS.messageEnd, { chatId: options.chatId })
      }
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
  const text = [...history].reverse().find((message) => message.role === "user")?.text ?? ""
  return /\b(edit|rewrite|tailor|shorten|fix|update)\b/i.test(text)
}

async function maybeTitle(
  userId: string,
  chatId: string,
  coachText: string,
  status: string,
  currentMessageId: string
) {
  const chat = await getChat(userId, chatId)
  const messages = chat.messages
    .filter((message) => message.id !== currentMessageId)
    .map((message) => ({
      role: message.role === "person" ? ("user" as const) : ("coach" as const),
      text: message.text,
      status: message.status ?? undefined,
    }))
  const decision = shouldAutoTitleThread({
    currentTitle: chat.title,
    messages,
    status,
  })
  if (!decision) return
  const title = deterministicThreadTitle({ userText: decision.userText, coachText })
  if (!title || title === chat.title) return
  await renameChat({ type: "person", userId }, chatId, title)
}

async function* liveParts(input: {
  model?: LanguageModel
  history: ThreadMessage[]
  registry: Registry
  actor: { type: "coach"; userId: string; chatId: string }
  focusDoc?: CoachFocusDoc
  selection?: CoachSelection
}): AsyncGenerator<CoachStreamPart> {
  if (!input.model) {
    yield { type: "error", message: "The Coach is unavailable right now" }
    return
  }
  const tools: ToolSet = {}
  for (const entry of input.registry.tools(input.actor)) {
    const name = entry.name.replaceAll(".", "_")
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
        if (result.pending) {
          return {
            ok: true,
            pending: true,
            pendingActionId: result.pendingActionId,
            summary: result.summary,
            command: result.command,
          }
        }
        return {
          ok: true,
          summary: entry.step(args),
          output: result.output,
          activityId: result.activityId,
        }
      },
    })
  }
  const focus = input.focusDoc
    ? `The open document is ${input.focusDoc.name} (${input.focusDoc.kind}).`
    : ""
  const result = streamText({
    model: input.model,
    system: `${SYSTEM_PROMPT} ${focus}`.trim(),
    messages: input.history.map((message) => ({
      role: message.role === "coach" ? ("assistant" as const) : ("user" as const),
      content: message.text,
    })),
    tools,
    stopWhen: stepCountIs(8),
  })
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      const text = "text" in part ? part.text : ""
      if (text) yield { type: "text-delta", text }
      continue
    }
    if (part.type === "tool-call") {
      yield {
        type: "tool-call",
        toolCallId: part.toolCallId,
        name: part.toolName,
        input: part.input,
      }
      continue
    }
    if (part.type === "tool-result") {
      const output = part.output as {
        ok?: boolean
        summary?: string
        pending?: boolean
        pendingActionId?: string
        command?: string
        data?: unknown
        activityId?: string
      }
      yield {
        type: "tool-result",
        toolCallId: part.toolCallId,
        name: part.toolName,
        summary: output.summary ?? part.toolName,
        ok: output.ok !== false,
        result: output.ok === false
          ? { ok: false, error: { code: "INTERNAL_ERROR", message: "Tool failed" } }
          : { ok: true, data: output.data ?? output },
      }
    }
  }
  yield {
    type: "finish",
    finishReason: "stop",
    usage: { model: "routed", finishReason: "stop" },
  }
}
