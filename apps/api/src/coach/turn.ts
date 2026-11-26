import { type Plan } from "@workspace/domain/account"
import {
  appendCoachPart,
  commandNameSchema,
  deterministicChatTitle,
  focusedEditNeedsPaperEdit,
  shouldAutoTitleChat,
  textFromParts,
  type ChatTurnEvent,
  type CoachFocusDoc,
  type CoachMode,
  type CoachRuntime,
  type CoachSelection,
  type CoachStreamPart,
  type CoachTurnUsage,
  type ChatEntry,
  type ChatEntryPart,
  type ChatMessageStatus,
} from "@workspace/domain/coach"
import {
  coachActor,
  parseChatId,
  parseUserId,
  personActor,
  type CoachActor,
} from "@workspace/domain/kernel"
import { streamAnthropicSteps, type CoachModel } from "./anthropic-runtime.js"
import type { SSEStreamingApi } from "hono/streaming"

import { readUsage } from "../account/index.js"
import { getChat, renameChat } from "./chat/index.js"
import { registry as defaultRegistry } from "../registry/registry.js"
import type { Registry, ToolEntry } from "../registry/registry.js"
import {
  eventForPart,
  isDisconnected,
  takeUntilAbort,
  waitForAbort,
  writeChatEvent,
  writeHeartbeat,
} from "./sse.js"
import {
  createTurnEffects,
  finishCoachUsage,
  insertCoachMessage,
  openCoachUsage,
  trackChatTurn,
} from "./turn-steps.js"

import { coachTurnContext } from "./instructions.js"
import { COACH_STABLE_PROMPT } from "./prompt.js"

export { toolResultFromExecute } from "./receipt.js"

export async function runCoachTurn(options: {
  stream: SSEStreamingApi
  registry?: Registry
  runtime?: CoachRuntime
  model?: CoachModel
  userId: string
  chatId: string
  mode: CoachMode
  plan: Plan
  provider: string
  modelId: string
  history: ChatEntry[]
  focusDoc?: CoachFocusDoc
  selection?: CoachSelection
  note?: string
  heartbeatMs: number
  signal?: AbortSignal
  usageId?: string
  allowTools?: boolean
  supersedesMessageId?: string
}) {
  const startedAt = Date.now()
  const registry = options.registry ?? defaultRegistry
  const usageId =
    options.usageId ??
    (await openCoachUsage({
      userId: options.userId,
      chatId: options.chatId,
      plan: options.plan,
      mode: options.mode,
      provider: options.runtime ? "fake" : options.provider,
      model: options.runtime ? "fake" : options.modelId,
    }))
  const effects = createTurnEffects(registry, {
    userId: options.userId,
    turnId: usageId,
  })
  const actor = coachActor(options.userId, options.chatId, usageId)
  const stop = new AbortController()
  const release = trackChatTurn(options.chatId, stop)
  options.stream.onAbort(() => stop.abort())
  const signal = AbortSignal.any([
    stop.signal,
    ...(options.signal ? [options.signal] : []),
  ])
  let parts: ChatEntryPart[] = []
  let status: ChatMessageStatus = "final"
  let usage: CoachTurnUsage = {
    model: options.runtime ? "fake" : options.modelId,
    mode: options.mode,
  }
  const called = new Set<string>()
  const heartbeat = setInterval(() => {
    void writeHeartbeat(options.stream)
  }, options.heartbeatMs)
  const aborted = waitForAbort(options.stream, signal)

  const emit = (event: ChatTurnEvent) => writeChatEvent(options.stream, event)

  try {
    const toolEntries =
      options.allowTools === false ? [] : await registry.tools(actor)
    await emit({ type: "message-start", chatId: options.chatId })
    const iterable = options.runtime
      ? options.runtime.streamTurn({
          userId: options.userId,
          chatId: options.chatId,
          history: options.history,
          model: options.modelId,
          mode: options.mode,
          focusDoc: options.focusDoc,
          selection: options.selection,
          note: options.note,
          execute:
            options.allowTools === false
              ? undefined
              : (call) =>
                  effects.execute({
                    name: call.name,
                    input: call.input,
                    actor,
                  }),
        })
      : liveParts({
          model: options.model,
          history: options.history,
          registry: effects.registry,
          actor,
          toolEntries,
          focusDoc: options.focusDoc,
          selection: options.selection,
          note: options.note,
          signal,
          mode: options.mode,
        })

    for await (const part of takeUntilAbort(iterable, aborted.promise, () =>
      isDisconnected(options.stream, signal)
    )) {
      if (isDisconnected(options.stream, signal)) {
        status = "aborted"
        break
      }
      if (
        options.allowTools === false &&
        (part.type === "tool-call" || part.type === "tool-result")
      ) {
        continue
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
      status === "final" &&
      !isDisconnected(options.stream, signal) &&
      !options.runtime &&
      options.allowTools !== false &&
      focusedEditNeedsPaperEdit({
        mode: options.mode,
        focusKind: options.focusDoc ? "paper" : null,
        askedForEdit: asked,
        calledEdit: called.has("paper.edit"),
      })
    ) {
      status = "error"
      await emit({
        type: "error",
        message:
          "The edit did not save. Ask again and I will update the document.",
      })
    }
  } catch {
    if (isDisconnected(options.stream, signal)) {
      status = "aborted"
    } else {
      status = "error"
      const message = "The Coach could not finish. Try again in a moment."
      await emit({ type: "error", message })
    }
  } finally {
    clearInterval(heartbeat)
    aborted.dispose()
    release()
    if (isDisconnected(options.stream, signal) && status === "final") {
      status = "aborted"
    }
    await effects.settleTools()
    const workedMs = Math.max(0, Date.now() - startedAt)
    let text: string
    let saved: { id: string } | null = null
    try {
      parts = await effects.recordMissingReceipts(parts)
      text = textFromParts(parts)
      saved =
        options.supersedesMessageId && !text.trim()
          ? null
          : await insertCoachMessage({
              chatId: parseChatId(options.chatId),
              userId: parseUserId(options.userId),
              text,
              parts,
              status,
              workedMs,
              supersedesMessageId: options.supersedesMessageId,
            })
    } finally {
      await finishCoachUsage({
        id: usageId,
        messageId: saved?.id ?? null,
        finishReason: usage.finishReason ?? status,
        latencyMs: workedMs,
        model: usage.model,
      })
    }
    if (saved)
      await maybeTitle({
        userId: options.userId,
        chatId: options.chatId,
        coachText: text,
        status,
        currentMessageId: saved.id,
      }).catch(() => {
        console.error("Coach automatic title failed", {
          chatId: options.chatId,
        })
      })
    if (!isDisconnected(options.stream, signal)) {
      const snapshot = await readUsage(options.userId).catch(() => null)
      await emit({
        type: "usage",
        plan: options.plan,
        mode: options.mode,
        capped: snapshot?.day.capped === true && snapshot.day.remaining === 0,
      })
      await emit({ type: "message-end", chatId: options.chatId })
    }
  }
}

function askedForEdit(history: ChatEntry[], selection?: CoachSelection) {
  if (selection?.text) return true
  const text =
    [...history].reverse().find((message) => message.role === "user")?.text ??
    ""
  return /\b(edit|rewrite|tailor|shorten|fix|update)\b/i.test(text)
}

async function maybeTitle(input: {
  userId: string
  chatId: string
  coachText: string
  status: string
  currentMessageId: string
}) {
  if (input.status !== "final") return
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
  const decision = shouldAutoTitleChat({
    currentTitle: chat.title,
    messages,
    status: input.status,
  })
  if (!decision) return
  const title = deterministicChatTitle({
    userText: decision.userText,
    coachText: input.coachText,
  })
  if (!title || title === chat.title) return
  await renameChat(personActor(input.userId), parseChatId(input.chatId), title)
}

export async function* liveParts(input: {
  model?: CoachModel
  history: ChatEntry[]
  registry: Pick<Registry, "read" | "execute">
  actor: CoachActor
  toolEntries: ToolEntry[]
  focusDoc?: CoachFocusDoc
  selection?: CoachSelection
  note?: string
  signal?: AbortSignal
  mode?: CoachMode
}): AsyncGenerator<CoachStreamPart> {
  if (!input.model) {
    yield { type: "error", message: "The Coach is unavailable right now" }
    return
  }
  const grounding = coachTurnContext({
    focusDoc: input.focusDoc,
    selection: input.selection,
    note: input.note,
  })
  yield* streamAnthropicSteps({
    model: input.model,
    system: COACH_STABLE_PROMPT,
    uncached: `Context: ${grounding}`,
    history: input.history,
    entries: input.toolEntries,
    registry: input.registry,
    actor: input.actor,
    signal: input.signal,
    mode: input.mode,
  })
}
