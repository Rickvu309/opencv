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
  PLAN_REQUIRED_MESSAGE,
  type CoachFocusDoc,
  type CoachMode,
  type CoachRuntime,
  type Plan,
} from "@workspace/domain"
import type { LanguageModel } from "ai"
import { Hono, type Context } from "hono"
import { streamSSE } from "hono/streaming"

import { assertDayCap, getProfileRow } from "../account/index.js"
import type { Auth } from "../auth.js"
import { reverseCompatReceipt } from "../compat/index.js"
import type { AppDatabase } from "../db/context.js"
import { readJsonBody } from "../http-json.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"
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

  const profile = await getProfileRow(c.var.userId)
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
  let history: Awaited<ReturnType<typeof registry.read>>
  if (parsed.data.regenerate) {
    history = await registry.read("chat.get", { chatId }, {
      type: "person",
      userId: c.var.userId,
    })
  } else {
    const posted = await registry.execute({
      name: "chat.appendMessage",
      input: { chatId, text: parsed.data.text },
      actor: { type: "person", userId: c.var.userId },
    })
    history = posted.output
  }
  const detail = history as {
    messages: {
      id: string
      role: "person" | "coach"
      text: string
      createdAt: string
      parts?: []
      status?: "final"
    }[]
  }
  const messages = detail.messages.map((message) => ({
    ...message,
    role: message.role === "person" ? ("user" as const) : ("coach" as const),
  }))

  let model: LanguageModel | undefined
  let provider = "fake"
  let modelId = "fake"
  if (!coach) {
    model = routeCoachModel({ plan, mode })
    provider = plan === "free" ? "openrouter" : "anthropic"
    modelId = "routed"
  }

  let focusDoc: CoachFocusDoc | undefined
  if (parsed.data.focusDocId) {
    const doc = (await registry.read(
      "paper.get",
      { docId: parsed.data.focusDocId },
      { type: "person", userId: c.var.userId }
    )) as {
      id: string
      name: string
      kind: "cv" | "letter"
      status: "draft" | "ready" | "published"
      document: unknown
      contentVersion: number
    }
    focusDoc = {
      id: doc.id,
      name: doc.name,
      kind: doc.kind,
      status: doc.status,
      content: doc.document,
      contentVersion: doc.contentVersion,
    }
  }

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
      focusDoc,
      selection: parsed.data.selection,
      heartbeatMs,
      signal: c.req.raw.signal,
    })
  })
}
