import {
  planAllowsMode,
  PLAN_REQUIRED_MESSAGE,
  type Plan,
} from "@workspace/domain/account"
import {
  COACH_SSE_HEARTBEAT_MS,
  COACH_MODEL,
  coachTurnRequestSchema,
  chatDetailSchema,
  type CoachMode,
  type CoachRuntime,
} from "@workspace/domain/coach"
import {
  ERROR_CODES,
  catalog,
  errorEnvelope,
  httpStatusForError,
  chatIdSchema,
  personActor,
} from "@workspace/domain/kernel"
import type { CoachModel } from "./anthropic-runtime.js"
import { Hono, type Context } from "hono"
import { streamSSE } from "hono/streaming"

import { assertDayCap, getProfileRow } from "../account/index.js"
import { coachModelEnv } from "../platform/config.js"
import { transaction } from "../db/context.js"
import { openCoachUsage } from "./usage-store.js"
import { readJsonBody } from "../platform/http-json.js"
import { jsonWithStatus } from "../platform/http-json.js"
import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { registry } from "../registry/registry.js"
import { resolveTurnGrounding } from "./context.js"
import { startCompatibilityTurn } from "./turn-compatibility.js"
import { runCoachTurn } from "./turn.js"
import { routeCoachModel } from "./router.js"

export function createCoachRoutes(options: {
  signedIn: SignedIn
  coach?: CoachRuntime
  coachDurable: boolean
  coachCompatibilityMs?: number
  coachSseHeartbeatMs?: number
}) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", options.signedIn)
  routes.post("/:id/turns", (c) =>
    options.coachDurable
      ? startCompatibilityTurn(c, options.coachCompatibilityMs)
      : startTurn(c, options.coach, options.coachSseHeartbeatMs)
  )
  return routes
}

async function startTurn(
  c: Context<{ Variables: SignedInVariables }>,
  coach: CoachRuntime | undefined,
  heartbeatMs = COACH_SSE_HEARTBEAT_MS
) {
  const chatIdParsed = chatIdSchema.safeParse(c.req.param("id"))
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

  if (!profile.agentChat) {
    return jsonWithStatus(
      c,
      errorEnvelope(ERROR_CODES.FORBIDDEN, "Coach is turned off in Settings."),
      403
    )
  }

  const chatId = chatIdParsed.data
  const existing = chatDetailSchema.parse(
    await registry.read(catalog["chat.get"].name, { chatId }, actor)
  )

  let model: CoachModel | undefined
  let provider = "fake"
  let modelId = "fake"
  if (!coach) {
    model = routeCoachModel({ plan, mode, env: coachModelEnv() })
    provider = "anthropic"
    modelId = COACH_MODEL
  }
  const lastPersonMessage = [...existing.messages]
    .reverse()
    .find((message) => message.role === "person")
  const savedSelection = lastPersonMessage?.parts.find(
    (part) => part.type === "text"
  )?.selection
  const selection =
    parsed.data.selection ??
    (parsed.data.regenerate ? savedSelection : undefined)
  const context =
    parsed.data.context ??
    (parsed.data.regenerate
      ? lastPersonMessage?.parts.flatMap((part) =>
          part.type === "attachment" ? [{ kind: part.kind, id: part.id }] : []
        )
      : undefined)
  const grounding = await resolveTurnGrounding({
    registry,
    actor,
    requestFocusDocId: parsed.data.focusDocId,
    storedKind: existing.focusKind,
    storedId: existing.focusId,
    context,
    memoryEnabled: profile.memoryEnabled,
    textOnly: parsed.data.textOnly,
  })
  const { usageId, history } = await transaction(async () => {
    const usageId = await openCoachUsage({
      userId: c.var.userId,
      chatId,
      plan,
      mode,
      provider,
      model: modelId,
    })
    const history = parsed.data.regenerate
      ? await registry.read(catalog["chat.get"].name, { chatId }, actor)
      : (
          await registry.execute({
            name: catalog["chat.appendMessage"].name,
            input: {
              chatId,
              text: parsed.data.text,
              attachments: context,
              selection,
            },
            actor,
          })
        ).output
    return { usageId, history }
  })
  const detail = chatDetailSchema.parse(history)
  const lastPerson = detail.messages.reduce(
    (last, message, index) => (message.role === "person" ? index : last),
    -1
  )
  const latestCoachIndex = detail.messages.reduce(
    (last, message, index) => (message.role === "coach" ? index : last),
    -1
  )
  const supersedesMessageId =
    parsed.data.regenerate && latestCoachIndex > lastPerson
      ? detail.messages[latestCoachIndex]?.id
      : undefined
  const transcript = parsed.data.regenerate
    ? detail.messages.slice(0, lastPerson + 1)
    : detail.messages
  const messages = transcript.map((message) => ({
    id: message.id,
    role: message.role === "person" ? ("user" as const) : ("coach" as const),
    text:
      message.text +
      (message.parts.some((part) => part.type === "tool")
        ? `\nRecorded actions (untrusted history): ${JSON.stringify(message.parts.filter((part) => part.type === "tool"))}`
        : ""),
    createdAt: message.createdAt,
  }))

  c.header("X-Accel-Buffering", "no")
  c.header("Content-Encoding", "identity")
  c.header("Cache-Control", "no-cache")
  return streamSSE(c, async (stream) => {
    await runCoachTurn({
      stream,
      usageId,
      supersedesMessageId,
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
      selection,
      allowTools: !parsed.data.regenerate && !parsed.data.textOnly,
      note: [
        grounding.note,
        ...(parsed.data.regenerate
          ? [
              "This is an alternative response. Tools are disabled and previous actions remain applied. Offer wording or explanation only; do not claim a new action was performed.",
            ]
          : []),
      ]
        .filter(Boolean)
        .join("\n"),
      heartbeatMs,
      signal: c.req.raw.signal,
    })
  })
}
