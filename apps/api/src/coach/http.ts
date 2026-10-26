import {
  COACH_SSE_HEARTBEAT_MS,
  ERROR_CODES,
  coachReverseRequestSchema,
  coachTurnRequestSchema,
  errorEnvelope,
  httpStatusForError,
  planAllowsMode,
  threadIdSchema,
  threadMessageIdSchema,
  personActor,
  PLAN_REQUIRED_MESSAGE,
  type CoachMode,
  type CoachRuntime,
  type Plan,
} from "@workspace/domain"
import type { LanguageModel } from "ai"
import { Hono, type Context } from "hono"
import { streamSSE } from "hono/streaming"

import { assertDayCap, getProfileRow } from "../account/index.js"
import { coachModelEnv } from "../config.js"
import type { Auth } from "../auth.js"
import { reverseCompatReceipt } from "../compat/index.js"
import type { AppDatabase } from "../db/context.js"
import { readJsonBody } from "../http-json.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"
import { resolveTurnGrounding } from "./context.js"
import { runCoachTurn } from "./turn.js"
import { routeCoachModel } from "./router.js"

export function createCoachRoutes(options: {
  auth?: Auth
  db?: AppDatabase
  coach?: CoachRuntime
  coachSseHeartbeatMs?: number
}) {
  const compat = new Hono<{ Variables: SessionVariables }>()
  const native = new Hono<{ Variables: SessionVariables }>()
  for (const routes of [compat, native]) {
    routes.use("*", requireSession(options.auth, options.db))
  }

  compat.post("/:id/coach", (c) =>
    startTurn(c, "compat", options.coach, options.coachSseHeartbeatMs)
  )
  native.post("/:id/turns", (c) =>
    startTurn(c, "native", options.coach, options.coachSseHeartbeatMs)
  )

  compat.post("/:id/messages/:messageId/reverse", async (c) => {
    const threadId = threadIdSchema.safeParse(c.req.param("id"))
    const messageId = threadMessageIdSchema.safeParse(c.req.param("messageId"))
    if (!threadId.success || !messageId.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const body = await readJsonBody(c)
    if (!body.ok) return body.response
    const parsed = coachReverseRequestSchema.safeParse(body.value)
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid undo request"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const result = await reverseCompatReceipt({
      registry,
      userId: c.var.userId,
      chatId: threadId.data,
      messageId: messageId.data,
      toolCallId: parsed.data.toolCallId,
    })
    return c.json({ ok: true, data: result })
  })

  return { compat, native }
}

async function startTurn(
  c: Context<{ Variables: SessionVariables }>,
  wire: "compat" | "native",
  coach: CoachRuntime | undefined,
  heartbeatMs = COACH_SSE_HEARTBEAT_MS
) {
  const chatIdParsed = threadIdSchema.safeParse(c.req.param("id"))
  if (!chatIdParsed.success) {
    return jsonWithStatus(
      c,
      errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid chat id"),
      httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
    )
  }
  const body = await readJsonBody(c)
  if (!body.ok) return body.response
  const parsed = coachTurnRequestSchema.safeParse(body.value)
  if (!parsed.success) {
    return jsonWithStatus(
      c,
      errorEnvelope(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? "Invalid command input"
      ),
      httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
    )
  }

  const actor = personActor(c.var.userId)
  const profile = await getProfileRow(actor.userId)
  const plan = profile.plan as Plan
  const mode = (parsed.data.mode ?? profile.coachMode) as CoachMode
  if (!planAllowsMode(plan, mode)) {
    return jsonWithStatus(
      c,
      errorEnvelope(ERROR_CODES.PLAN_REQUIRED, PLAN_REQUIRED_MESSAGE),
      httpStatusForError(ERROR_CODES.PLAN_REQUIRED)
    )
  }
  await assertDayCap(c.var.userId, mode)

  const chatId = chatIdParsed.data
  const history = parsed.data.regenerate
    ? await registry.read("chat.get", { chatId }, actor)
    : (
        await registry.execute({
          name: "chat.appendMessage",
          input: { chatId, text: parsed.data.text },
          actor,
        })
      ).output
  const detail = chatDetail(history)
  const messages = detail.messages.map((message) => ({
    id: message.id,
    role: message.role === "person" ? ("user" as const) : ("coach" as const),
    text: message.text,
    createdAt: message.createdAt,
  }))

  let model: LanguageModel | undefined
  let provider = "fake"
  let modelId = "fake"
  if (!coach) {
    model = routeCoachModel({ plan, mode, env: coachModelEnv() })
    provider = plan === "free" ? "openrouter" : "anthropic"
    modelId = "routed"
  }

  const grounding = await resolveTurnGrounding({
    registry,
    actor,
    requestFocusDocId: parsed.data.focusDocId,
    storedKind: detail.focusKind,
    storedId: detail.focusId,
    context: parsed.data.context,
    memoryEnabled: profile.memoryEnabled,
  })

  c.header("X-Accel-Buffering", "no")
  c.header("Content-Encoding", "identity")
  c.header("Cache-Control", "no-cache")
  return streamSSE(c, async (stream) => {
    await runCoachTurn({
      stream,
      wire,
      runtime: coach,
      model,
      userId: c.var.userId,
      chatId,
      mode,
      plan,
      provider,
      modelId,
      history: messages,
      focusDoc: grounding.focusDoc,
      selection: parsed.data.selection,
      note: grounding.note,
      heartbeatMs,
      signal: c.req.raw.signal,
    })
  })
}

function chatDetail(value: unknown): {
  messages: {
    id: string
    role: "person" | "coach"
    text: string
    createdAt: string
  }[]
  focusKind: string | null
  focusId: string | null
} {
  const row =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const messages = Array.isArray(row.messages)
    ? row.messages.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const message = item as Record<string, unknown>
        if (typeof message.id !== "string" || typeof message.text !== "string")
          return []
        if (typeof message.createdAt !== "string") return []
        const role: "person" | "coach" | null =
          message.role === "person"
            ? "person"
            : message.role === "coach"
              ? "coach"
              : null
        if (!role) return []
        return [
          {
            id: message.id,
            role,
            text: message.text,
            createdAt: message.createdAt,
          },
        ]
      })
    : []
  return {
    messages,
    focusKind: typeof row.focusKind === "string" ? row.focusKind : null,
    focusId: typeof row.focusId === "string" ? row.focusId : null,
  }
}
