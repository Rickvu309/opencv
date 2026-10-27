import {
  COACH_SSE_EVENTS,
  ERROR_CODES,
  appendCoachPart,
  coachActor,
  deterministicThreadTitle,
  focusedEditNeedsReplace,
  parseChatId,
  parseUserId,
  personActor,
  shouldAutoTitleThread,
  textFromParts,
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
import { getDb } from "../db/context.js"
import { pendingActions } from "../db/schema.js"
import { createId } from "../id.js"
import { getChat, insertCoachMessage, trackChatTurn } from "../chat/index.js"
import { registry as defaultRegistry } from "../registry/registry.js"
import type { Registry, ToolEntry } from "../registry/registry.js"
import { toolResultFromExecute } from "./receipt.js"
import { titleFromModel } from "./router.js"
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

export { toolResultFromExecute } from "./receipt.js"

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
  note?: string
  readLabel?: string
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
  const stepped = new Set<string>()
  const heartbeat = setInterval(() => {
    void writeHeartbeat(options.stream)
  }, options.heartbeatMs)
  const aborted = waitForAbort(options.stream, signal)
  const toolEntries = await registry.tools(actor)

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
    if (options.wire === "native" && options.readLabel) {
      await emit(COACH_SSE_EVENTS.step, { label: options.readLabel })
    }
    const iterable = options.runtime
      ? expandDemoConfirm(
          options.runtime.streamTurn({
            userId: options.userId,
            threadId: options.chatId,
            history: options.history,
            model: options.modelId,
            mode: options.mode,
            focusDoc: options.focusDoc,
            selection: options.selection,
            note: options.note,
          }),
          {
            registry,
            userId: options.userId,
            chatId: options.chatId,
          }
        )
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
        await emit(COACH_SSE_EVENTS.error, {
          message: publicCoachErrorMessage(part.message),
        })
        break
      }
      if (part.type === "tool-call" && options.wire === "native") {
        const entry = toolEntries.find(
          (item) =>
            item.name === part.name ||
            item.name.replaceAll(".", "_") === part.name
        )
        if (entry) {
          await emit(COACH_SSE_EVENTS.step, { label: entry.step(part.input) })
          stepped.add(part.toolCallId)
        }
      }
      if (
        part.type === "tool-result" &&
        options.wire === "native" &&
        !stepped.has(part.toolCallId)
      ) {
        const label = part.summary || part.name
        if (label) {
          await emit(COACH_SSE_EVENTS.step, { label })
          stepped.add(part.toolCallId)
        }
      }
      if (
        part.type === "text-delta" ||
        part.type === "tool-call" ||
        part.type === "tool-result"
      ) {
        await emit(part.type, sseDataForPart(part))
      }
      if (part.type === "tool-result" && part.pendingActionId && part.command) {
        await emit(COACH_SSE_EVENTS.confirm, {
          pendingActionId: part.pendingActionId,
          command: part.command,
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
        calledReplace:
          called.has("paper.replace") || called.has("paper_replace"),
      })
    ) {
      status = "error"
      await emit(COACH_SSE_EVENTS.error, {
        message:
          "The edit did not save. Ask again and I will update the document.",
      })
    }
  } catch (error) {
    if (isDisconnected(options.stream, signal)) {
      status = "aborted"
    } else {
      status = "error"
      const message = error instanceof Error ? error.message : ""
      await emit(COACH_SSE_EVENTS.error, {
        message: publicCoachErrorMessage(message),
      })
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
      const message = {
        id: saved.id,
        role: "coach" as const,
        text: saved.text,
        createdAt: saved.createdAt,
        parts,
        status,
        workedMs,
      }
      if (options.wire === "compat") {
        await emit(COACH_SSE_EVENTS.messageEnd, {
          message,
          usage: { ...usage, latencyMs: workedMs, mode: options.mode },
        })
      } else {
        const snapshot = await readUsage(options.userId).catch(() => null)
        const day = snapshot?.day
        const reached =
          day?.capped === true && "remaining" in day && day.remaining <= 0
        await emit(COACH_SSE_EVENTS.usage, {
          plan: options.plan,
          mode: options.mode,
          capped: reached,
        })
        await emit(COACH_SSE_EVENTS.messageEnd, {
          chatId: options.chatId,
          workedMs,
        })
      }
    }
  }
}

const KEPT_STREAM_SENTENCES = new Set([
  "The Coach is unavailable right now",
  "The edit did not save. Ask again and I will update the document.",
])

export function publicCoachErrorMessage(message: string) {
  const trimmed = message.trim()
  if (/^[A-Z0-9_]+$/.test(trimmed)) return trimmed
  if (KEPT_STREAM_SENTENCES.has(trimmed)) return trimmed
  return ERROR_CODES.INTERNAL_ERROR
}

type PaperRow = {
  id?: string
  name?: string
  kind?: string
  document?: unknown
  contentVersion?: number
}

async function* expandDemoConfirm(
  parts: AsyncIterable<CoachStreamPart>,
  scope: { registry: Registry; userId: string; chatId: string }
): AsyncGenerator<CoachStreamPart> {
  for await (const part of parts) {
    if (part.type === "tool-call" && part.name === "coach.confirm") {
      yield* confirmScenario(scope)
      continue
    }
    yield part
  }
}

async function* confirmScenario(scope: {
  registry: Registry
  userId: string
  chatId: string
}): AsyncGenerator<CoachStreamPart> {
  const actor = coachActor(scope.userId, scope.chatId)
  const listed = await scope.registry.read("paper.list", {}, actor)
  const papers = Array.isArray(listed) ? (listed as PaperRow[]) : []
  let doc = papers.find((item) => item.id && item.document != null)
  if (!doc) {
    const created = await scope.registry.execute({
      name: "paper.create",
      input: { kind: "letter", name: "Coach note" },
      actor,
    })
    doc =
      created.output && typeof created.output === "object"
        ? (created.output as PaperRow)
        : {}
  }
  const docId = String(doc.id ?? "")
  const name = doc.name?.trim() || "Coach note"
  const kind = doc.kind === "cv" || doc.kind === "proof" ? doc.kind : "letter"
  const pendingId = createId()
  await getDb()
    .insert(pendingActions)
    .values({
      id: pendingId,
      userId: scope.userId,
      chatId: scope.chatId,
      command: "paper.replace",
      input: {
        docId,
        contentVersion: doc.contentVersion ?? 1,
        document: doc.document,
      },
      summary: "Update the document",
      status: "pending",
    })
  yield {
    type: "tool-call",
    toolCallId: "call_confirm",
    name: "paper.replace",
    input: {},
  }
  yield {
    type: "tool-result",
    toolCallId: "call_confirm",
    name: "paper.replace",
    summary: "Update the document",
    ok: true,
    pendingActionId: pendingId,
    command: "paper.replace",
    detail: {
      type: "paper.updateContent",
      docKind: kind,
      docName: name,
      hunks: [],
    },
    result: { ok: true, data: { id: docId, name } },
  }
  yield { type: "text-delta", text: "Approve to update the document." }
  yield {
    type: "finish",
    finishReason: "stop",
    usage: { model: "fake", finishReason: "stop" },
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
  for (const entry of input.toolEntries) {
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
        name: part.toolName,
        input: part.input,
      }
      continue
    }
    if (part.type === "tool-result") {
      const output = record(part.output)
      yield toolResultFromExecute({
        toolCallId: part.toolCallId,
        name: part.toolName,
        summary: textField(output?.summary) || part.toolName,
        result: {
          pending: output?.pending === true,
          pendingActionId: textField(output?.pendingActionId) || undefined,
          command: textField(output?.command) || part.toolName,
          summary: textField(output?.summary) || part.toolName,
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
