import {
  appendCoachPart,
  authUnavailableEnvelope,
  COACH_SSE_EVENTS,
  COACH_SSE_HEARTBEAT_MS,
  coachFeedbackInputSchema,
  coachReverseRequestSchema,
  coachLimitReachedEnvelope,
  coachTurnRequestSchema,
  coachUnavailableEnvelope,
  DEFAULT_COACH_DAILY_TURN_LIMIT,
  DEFAULT_COACH_DAILY_TURN_LIMITS,
  DEFAULT_COACH_MODE,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  resolveCoachModel,
  successEnvelope,
  textFromParts,
  THREAD_COMMANDS,
  threadIdSchema,
  threadMessageIdSchema,
  unauthorizedEnvelope,
  type CoachMode,
  type CoachRuntime,
  type CoachSseErrorData,
  type CoachSseMessageEndData,
  type CoachSseMessageStartData,
  type CoachFocusDoc,
  type CoachStreamPart,
  type CoachTurnUsage,
  type ThreadDetail,
  type ThreadMessage,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { streamSSE, type SSEStreamingApi } from "hono/streaming"

import type { Auth } from "../auth.js"
import {
  CommandError,
  type AppDatabase,
  type CommandRegistry,
} from "../commands/registry.js"
import { coachUsage, threadMessages, threads } from "../db/schema.js"
import { jsonWithStatus } from "../http-json.js"
import { createId } from "../id.js"
import { readSession } from "../session.js"
import { getOwnedPaperDoc } from "../paper/queries.js"
import { getCoachModeForUser } from "../profile/queries.js"
import { getOwnedThread, getThreadDetail, toThreadMessage } from "../threads/queries.js"
import { reverseCoachReceipt } from "./reverse.js"
import { maybeAutoTitleThread } from "./title.js"
import { countCoachTurnsToday, rateCoachTurn } from "./usage.js"

export type CoachRouteOptions = {
  auth?: Auth
  db?: AppDatabase
  registry: CommandRegistry
  coach?: CoachRuntime
  /** @deprecated Legacy single-model fallback when a turn has no resolved mode. */
  coachModel?: string
  /** Legacy global cap; used when a mode-specific limit is unset. */
  coachDailyTurnLimit?: number
  coachModels?: Partial<Record<CoachMode, string>>
  coachDailyTurnLimits?: Partial<Record<CoachMode, number>>
  coachSseHeartbeatMs?: number
}

export function createCoachRoutes({
  auth,
  db,
  registry,
  coach,
  coachModel,
  coachDailyTurnLimit,
  coachModels,
  coachDailyTurnLimits,
  coachSseHeartbeatMs,
}: CoachRouteOptions) {
  const routes = new Hono()

  routes.post("/:id/coach", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }
    if (!coach) {
      return c.json(coachUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const threadIdParsed = threadIdSchema.safeParse(c.req.param("id"))
    if (!threadIdParsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid thread id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const threadId = threadIdParsed.data

    let body: unknown
    try {
      const text = await c.req.text()
      body = text.trim() === "" ? {} : JSON.parse(text)
    } catch {
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request body must be JSON"
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const parsed = coachTurnRequestSchema.safeParse(
      typeof body === "object" && body && !Array.isArray(body) ? body : {}
    )
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid command input"
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, message),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    try {
      await getOwnedThread(db, session.user.id, threadId)
    } catch (error) {
      if (error instanceof CommandError) {
        return jsonWithStatus(
          c,
          errorEnvelope(error.code, error.message),
          error.status
        )
      }
      throw error
    }

    let focusDoc: CoachFocusDoc | undefined
    if (parsed.data.focusDocId) {
      try {
        const row = await getOwnedPaperDoc(
          db,
          session.user.id,
          parsed.data.focusDocId
        )
        focusDoc = {
          id: row.id,
          name: row.name,
          kind: row.contentKind,
          status: row.status,
        }
      } catch (error) {
        if (error instanceof CommandError) {
          return jsonWithStatus(
            c,
            errorEnvelope(error.code, error.message),
            error.status
          )
        }
        throw error
      }
    }

    const mode =
      parsed.data.mode ??
      (await getCoachModeForUser(db, session.user.id).catch(
        () => DEFAULT_COACH_MODE
      ))
    const model =
      coachModels?.[mode] ?? resolveCoachModel(mode) ?? coachModel ?? ""
    const limit =
      coachDailyTurnLimits?.[mode] ??
      coachDailyTurnLimit ??
      DEFAULT_COACH_DAILY_TURN_LIMITS[mode] ??
      DEFAULT_COACH_DAILY_TURN_LIMIT
    const used = await countCoachTurnsToday(db, session.user.id, new Date(), mode)
    if (used >= limit) {
      return c.json(coachLimitReachedEnvelope(), 429)
    }

    let history: ThreadMessage[]
    if (parsed.data.regenerate) {
      const detail = await getThreadDetail(db, session.user.id, threadId)
      const last = detail.messages[detail.messages.length - 1]
      if (!last || last.role !== "coach") {
        return jsonWithStatus(
          c,
          errorEnvelope(
            ERROR_CODES.VALIDATION_ERROR,
            "Only the latest Coach turn can be regenerated"
          ),
          httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
        )
      }
      history = detail.messages
    } else {
      const text = parsed.data.text
      if (!text) {
        return jsonWithStatus(
          c,
          errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Message text is required"),
          httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
        )
      }
      const posted = await registry.execute({
        name: THREAD_COMMANDS.postMessage,
        input: { threadId, text },
        actor: { type: "user", userId: session.user.id },
        db,
      })
      if (!posted.body.ok) {
        return jsonWithStatus(c, posted.body, posted.status)
      }
      history = (posted.body.data as ThreadDetail).messages
    }

    const heartbeatMs = coachSseHeartbeatMs ?? COACH_SSE_HEARTBEAT_MS

    c.header("X-Accel-Buffering", "no")
    c.header("Content-Encoding", "identity")

    return streamSSE(c, async (stream) => {
      await runCoachTurn({
        stream,
        coach,
        db,
        registry,
        userId: session.user.id,
        threadId,
        history,
        model,
        mode,
        regenerate: parsed.data.regenerate === true,
        focusDoc,
        heartbeatMs,
        signal: c.req.raw.signal,
      })
    })
  })

  routes.post("/:id/messages/:messageId/feedback", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const threadIdParsed = threadIdSchema.safeParse(c.req.param("id"))
    const messageIdParsed = threadMessageIdSchema.safeParse(
      c.req.param("messageId")
    )
    if (!threadIdParsed.success || !messageIdParsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    let body: unknown
    try {
      const text = await c.req.text()
      body = text.trim() === "" ? {} : JSON.parse(text)
    } catch {
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request body must be JSON"
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const parsed = coachFeedbackInputSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid rating"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    try {
      await getOwnedThread(db, session.user.id, threadIdParsed.data)
      const result = await rateCoachTurn(
        db,
        session.user.id,
        threadIdParsed.data,
        messageIdParsed.data,
        parsed.data.rating
      )
      return c.json(successEnvelope(result))
    } catch (error) {
      if (error instanceof CommandError) {
        return jsonWithStatus(
          c,
          errorEnvelope(error.code, error.message),
          error.status
        )
      }
      throw error
    }
  })

  routes.post("/:id/messages/:messageId/reverse", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const threadIdParsed = threadIdSchema.safeParse(c.req.param("id"))
    const messageIdParsed = threadMessageIdSchema.safeParse(
      c.req.param("messageId")
    )
    if (!threadIdParsed.success || !messageIdParsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    let body: unknown
    try {
      const text = await c.req.text()
      body = text.trim() === "" ? {} : JSON.parse(text)
    } catch {
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request body must be JSON"
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const parsed = coachReverseRequestSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid reversal"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    try {
      const result = await reverseCoachReceipt({
        db,
        registry,
        userId: session.user.id,
        threadId: threadIdParsed.data,
        messageId: messageIdParsed.data,
        toolCallId: parsed.data.toolCallId,
      })
      return c.json(successEnvelope(result))
    } catch (error) {
      if (error instanceof CommandError) {
        return jsonWithStatus(
          c,
          errorEnvelope(error.code, error.message),
          error.status
        )
      }
      throw error
    }
  })

  return routes
}

type RunCoachTurnOptions = {
  stream: SSEStreamingApi
  coach: CoachRuntime
  db: AppDatabase
  registry: CommandRegistry
  userId: string
  threadId: string
  history: ThreadMessage[]
  model: string
  mode: CoachMode
  regenerate?: boolean
  focusDoc?: CoachFocusDoc
  heartbeatMs: number
  signal?: AbortSignal
}

async function runCoachTurn({
  stream,
  coach,
  db,
  registry,
  userId,
  threadId,
  history,
  model,
  mode,
  regenerate,
  focusDoc,
  heartbeatMs,
  signal,
}: RunCoachTurnOptions) {
  const startedAt = Date.now()
  let parts: ThreadMessagePart[] = []
  let status: ThreadMessageStatus = "final"
  let usage: CoachTurnUsage = { model, mode }
  let persisted: ThreadMessage | undefined

  const heartbeat = setInterval(() => {
    void writeHeartbeat(stream)
  }, heartbeatMs)

  const aborted = waitForAbort(stream, signal)

  try {
    const start: CoachSseMessageStartData = { threadId }
    await writeEvent(stream, COACH_SSE_EVENTS.messageStart, start)

    for await (const part of takeUntilAbort(
      coach.streamTurn({
        userId,
        threadId,
        history,
        model,
        mode,
        regenerate,
        focusDoc,
      }),
      aborted.promise,
      () => isDisconnected(stream, signal)
    )) {
      if (isDisconnected(stream, signal)) {
        status = "aborted"
        break
      }

      const terminal = applyStreamPart(part, {
        parts,
        status,
        usage,
        model,
      })
      parts = terminal.parts
      status = terminal.status
      usage = terminal.usage

      if (part.type === "finish") {
        break
      }
      if (part.type === "error") {
        await writeEvent(stream, COACH_SSE_EVENTS.error, {
          message: part.message,
        } satisfies CoachSseErrorData)
        break
      }
      if (
        part.type !== "text-delta" &&
        part.type !== "tool-call" &&
        part.type !== "tool-result"
      ) {
        continue
      }
      await writeEvent(stream, part.type, sseDataForPart(part))
    }

    if (isDisconnected(stream, signal)) {
      status = "aborted"
    }
  } catch (error) {
    if (isDisconnected(stream, signal)) {
      status = "aborted"
    } else {
      status = "error"
      const message =
        error instanceof Error ? error.message : "The Coach could not finish"
      await writeEvent(stream, COACH_SSE_EVENTS.error, {
        message,
      } satisfies CoachSseErrorData)
    }
  } finally {
    clearInterval(heartbeat)
    aborted.dispose()

    if (isDisconnected(stream, signal) && status === "final") {
      status = "aborted"
    }

    const workedMs = Math.max(0, Date.now() - startedAt)
    usage = {
      ...usage,
      model: usage.model || model,
      mode,
      latencyMs: usage.latencyMs ?? workedMs,
      finishReason: usage.finishReason ?? status,
    }

    persisted = await persistCoachTurn({
      db,
      userId,
      threadId,
      parts,
      status,
      workedMs,
      usage,
      mode,
    })

    await maybeAutoTitleThread({
      db,
      registry,
      coach,
      userId,
      threadId,
      history,
      coachText: textFromParts(parts),
      status,
    })

    if (!isDisconnected(stream, signal)) {
      const end: CoachSseMessageEndData = {
        message: persisted,
        usage,
      }
      await writeEvent(stream, COACH_SSE_EVENTS.messageEnd, end)
    }
  }
}

function applyStreamPart(
  part: CoachStreamPart,
  state: {
    parts: ThreadMessagePart[]
    status: ThreadMessageStatus
    usage: CoachTurnUsage
    model: string
  }
) {
  const next = {
    parts: appendCoachPart(state.parts, part),
    status: state.status,
    usage: state.usage,
  }

  if (part.type === "finish") {
    next.usage = {
      model: part.usage.model || state.model,
      mode: part.usage.mode ?? state.usage.mode,
      tokens: part.usage.tokens,
      costEstimate: part.usage.costEstimate,
      latencyMs: part.usage.latencyMs,
      finishReason: part.finishReason,
    }
  }
  if (part.type === "error") {
    next.status = "error"
  }

  return next
}

function sseDataForPart(part: CoachStreamPart): unknown {
  switch (part.type) {
    case "text-delta":
      return { text: part.text }
    case "tool-call":
      return {
        toolCallId: part.toolCallId,
        name: part.name,
        input: part.input,
      }
    case "tool-result":
      return {
        toolCallId: part.toolCallId,
        name: part.name,
        summary: part.summary,
        ok: part.ok,
        ...(part.reversal ? { reversal: part.reversal } : {}),
        result: part.result,
      }
    default:
      return {}
  }
}

async function persistCoachTurn({
  db,
  userId,
  threadId,
  parts,
  status,
  workedMs,
  usage,
  mode,
}: {
  db: AppDatabase
  userId: string
  threadId: string
  parts: ThreadMessagePart[]
  status: ThreadMessageStatus
  workedMs: number
  usage: CoachTurnUsage
  mode: CoachMode
}): Promise<ThreadMessage> {
  const now = new Date()
  const messageId = createId(now.getTime())
  const usageId = createId(now.getTime())
  const text = textFromParts(parts)
  const row = {
    id: messageId,
    threadId,
    role: "coach" as const,
    text,
    parts,
    status,
    workedMs,
    createdAt: now,
  }

  await db.transaction(async (tx: AppDatabase) => {
    await tx.insert(threadMessages).values(row)
    await tx
      .update(threads)
      .set({ updatedAt: now })
      .where(eq(threads.id, threadId))
    await tx.insert(coachUsage).values({
      id: usageId,
      userId,
      threadId,
      messageId,
      model: usage.model,
      mode,
      tokens: usage.tokens,
      costEstimate: usage.costEstimate,
      latencyMs: usage.latencyMs,
      finishReason: usage.finishReason,
    })
  })

  return toThreadMessage({ ...row, rating: null })
}

function isDisconnected(stream: SSEStreamingApi, signal?: AbortSignal) {
  return stream.aborted || Boolean(signal?.aborted)
}

function waitForAbort(stream: SSEStreamingApi, signal?: AbortSignal) {
  let settled = false
  let resolve = () => {}
  const promise = new Promise<void>((r) => {
    resolve = r
  })

  const settle = () => {
    if (settled) return
    settled = true
    resolve()
  }

  stream.onAbort(settle)
  signal?.addEventListener("abort", settle, { once: true })
  if (isDisconnected(stream, signal)) settle()

  return {
    promise,
    dispose() {
      signal?.removeEventListener("abort", settle)
      settle()
    },
  }
}

async function* takeUntilAbort<T>(
  iterable: AsyncIterable<T>,
  abort: Promise<void>,
  isAborted: () => boolean
): AsyncGenerator<T> {
  const iterator = iterable[Symbol.asyncIterator]()
  try {
    while (!isAborted()) {
      const outcome = await Promise.race([
        iterator.next().then((value) => ({ kind: "next" as const, value })),
        abort.then(() => ({ kind: "abort" as const })),
      ])
      if (outcome.kind === "abort" || isAborted()) return
      if (outcome.value.done) return
      yield outcome.value.value
    }
  } finally {
    void iterator.return?.()
  }
}

async function writeEvent(
  stream: SSEStreamingApi,
  event: string,
  data: unknown
) {
  if (stream.aborted) return
  try {
    await stream.writeSSE({
      event,
      data: JSON.stringify(data),
    })
  } catch {
    // Client gone — persistence still runs in finally.
  }
}

async function writeHeartbeat(stream: SSEStreamingApi) {
  if (stream.aborted) return
  try {
    await stream.write(": heartbeat\n\n")
  } catch {
    // ignore
  }
}
