import {
  COACH_SSE_HEARTBEAT_MS,
  coachFeedbackInputSchema,
  coachReverseRequestSchema,
  coachLimitReachedEnvelope,
  coachTurnRequestSchema,
  coachUnavailableEnvelope,
  DEFAULT_COACH_DAILY_TURN_LIMITS,
  DEFAULT_COACH_MODE,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  resolveCoachModel,
  successEnvelope,
  THREAD_COMMANDS,
  threadIdSchema,
  threadMessageIdSchema,
  type CoachMode,
  type CoachRuntime,
  type CoachFocusDoc,
  type ThreadDetail,
  type ThreadMessage,
} from "@workspace/domain"
import { Hono, type MiddlewareHandler } from "hono"
import { streamSSE } from "hono/streaming"

import type { Auth } from "../auth.js"
import type { AppDatabase, CommandRegistry } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { getOwnedPaperDoc } from "../paper/queries.js"
import { toCoachFocusDoc } from "./must-edit.js"
import { getCoachModeForUser } from "../profile/queries.js"
import { getOwnedThread, getThreadDetail } from "../threads/queries.js"
import { reverseCoachReceipt } from "./reverse.js"
import { runCoachTurn } from "./turn.js"
import { countCoachTurnsToday, rateCoachTurn } from "./usage.js"

export type CoachRouteOptions = {
  auth?: Auth
  db?: AppDatabase
  registry: CommandRegistry
  coach?: CoachRuntime
  coachModels?: Partial<Record<CoachMode, string>>
  coachDailyTurnLimits?: Partial<Record<CoachMode, number>>
  coachSseHeartbeatMs?: number
}

// Unconfigured auth answers AUTH_UNAVAILABLE before a missing runtime answers
// COACH_UNAVAILABLE, and both come before the session check.
function requireCoach(
  auth: Auth | undefined,
  db: AppDatabase | undefined,
  coach: CoachRuntime | undefined
): MiddlewareHandler<{ Variables: { coach: CoachRuntime } }> {
  return async (c, next) => {
    if (coach) {
      c.set("coach", coach)
    } else if (auth && db) {
      return c.json(coachUnavailableEnvelope(), 503)
    }
    await next()
  }
}

export function createCoachRoutes({
  auth,
  db,
  registry,
  coach,
  coachModels,
  coachDailyTurnLimits,
  coachSseHeartbeatMs,
}: CoachRouteOptions) {
  const routes = new Hono<{
    Variables: SessionVariables & { coach: CoachRuntime }
  }>()

  routes.on("POST", "/:id/coach", requireCoach(auth, db, coach))
  routes.post("/:id/coach", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

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

    const thread = await getOwnedThread(db, userId, threadId)

    const focusDocId =
      parsed.data.focusDocId === null
        ? undefined
        : (parsed.data.focusDocId ?? thread.focusDocId ?? undefined)

    let focusDoc: CoachFocusDoc | undefined
    if (focusDocId) {
      focusDoc = toCoachFocusDoc(await getOwnedPaperDoc(db, userId, focusDocId))
    }

    const mode =
      parsed.data.mode ??
      (await getCoachModeForUser(db, userId).catch(() => DEFAULT_COACH_MODE))
    const model = coachModels?.[mode] ?? resolveCoachModel(mode)
    const limit =
      coachDailyTurnLimits?.[mode] ?? DEFAULT_COACH_DAILY_TURN_LIMITS[mode]
    const used = await countCoachTurnsToday(db, userId, new Date(), mode)
    if (used >= limit) {
      return c.json(coachLimitReachedEnvelope(), 429)
    }

    let history: ThreadMessage[]
    if (parsed.data.regenerate) {
      const detail = await getThreadDetail(db, userId, threadId)
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
          errorEnvelope(
            ERROR_CODES.VALIDATION_ERROR,
            "Message text is required"
          ),
          httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
        )
      }
      const posted = await registry.execute({
        name: THREAD_COMMANDS.postMessage,
        input: { threadId, text },
        actor: { type: "user", userId },
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
        coach: c.var.coach,
        db,
        registry,
        userId,
        threadId,
        history,
        model,
        mode,
        regenerate: parsed.data.regenerate === true,
        focusDoc,
        selection: parsed.data.selection,
        heartbeatMs,
        signal: c.req.raw.signal,
      })
    })
  })

  routes.post(
    "/:id/messages/:messageId/feedback",
    requireSession(auth, db),
    async (c) => {
      const { userId, db } = c.var

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

      await getOwnedThread(db, userId, threadIdParsed.data)
      const result = await rateCoachTurn(
        db,
        userId,
        threadIdParsed.data,
        messageIdParsed.data,
        parsed.data.rating
      )
      return c.json(successEnvelope(result))
    }
  )

  routes.post(
    "/:id/messages/:messageId/reverse",
    requireSession(auth, db),
    async (c) => {
      const { userId, db } = c.var

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

      const result = await reverseCoachReceipt({
        db,
        registry,
        userId,
        threadId: threadIdParsed.data,
        messageId: messageIdParsed.data,
        toolCallId: parsed.data.toolCallId,
      })
      return c.json(successEnvelope(result))
    }
  )

  return routes
}
