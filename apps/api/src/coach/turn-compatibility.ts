import { randomUUID } from "node:crypto"
import {
  chatIdSchema,
  coachTurnRequestSchema,
  chatToolNameSchema,
  commandNameSchema,
  personActor,
} from "@workspace/domain"
import type { Context } from "hono"
import { streamSSE } from "hono/streaming"
import { z } from "zod"
import { readJsonBody } from "../http-json.js"
import type { SessionVariables } from "../middleware.js"
import { CommandError } from "../registry/errors.js"
import { registry } from "../registry/registry.js"
import { startTask } from "./task-start.js"
import { readTaskEvents, taskSnapshot } from "./task-reader.js"
import { idleUntilAbort, waitForAbort, writeChatEvent } from "./sse.js"
import { toolResultFromExecute } from "./receipt.js"

export const COACH_COMPATIBILITY_MS = 30_000
const draftSchema = z.object({ text: z.string() })
const resultSchema = z.object({ output: z.unknown().optional() })

export async function startCompatibilityTurn(
  c: Context<{ Variables: SessionVariables }>,
  durationMs = COACH_COMPATIBILITY_MS
) {
  const chatId = chatIdSchema.safeParse(c.req.param("id"))
  if (!chatId.success)
    throw new CommandError("VALIDATION_ERROR", "Invalid chat id")
  const body = await readJsonBody(c)
  if (!body.ok) return body.response
  const parsed = coachTurnRequestSchema.safeParse(body.value)
  if (!parsed.success)
    throw new CommandError("VALIDATION_ERROR", "Invalid Coach turn")
  const started = await startTask(
    { ...parsed.data, chatId: chatId.data, startKey: randomUUID() },
    personActor(c.var.userId),
    registry
  )
  const ownerId = c.var.userId
  c.header("X-Accel-Buffering", "no")
  c.header("Content-Encoding", "identity")
  c.header("Cache-Control", "no-store")
  return streamSSE(c, async (stream) => {
    const abort = waitForAbort(stream, c.req.raw.signal)
    const idle = idleUntilAbort(abort)
    const deadline = Date.now() + Math.min(durationMs, COACH_COMPATIBILITY_MS)
    const outcomes = new Set<string>()
    let cursor = -1
    try {
      await writeChatEvent(stream, {
        type: "message-start",
        chatId: started.chatId,
      })
      while (!stream.aborted && !c.req.raw.signal.aborted) {
        if (Date.now() >= deadline) {
          await writeChatEvent(stream, {
            type: "text-delta",
            text: "Coach is still working. Reload this Chat to follow or stop it.",
          })
          await writeChatEvent(stream, {
            type: "message-end",
            chatId: started.chatId,
          })
          return
        }
        const batch = await readTaskEvents(started.taskId, ownerId, cursor)
        if (batch.type === "reset") {
          await writeChatEvent(stream, {
            type: "error",
            message: "Reload this Chat to see the saved Coach reply.",
          })
          return
        }
        for (const event of batch.events) {
          if (event.kind === "draft")
            await writeChatEvent(stream, {
              type: "text-delta",
              text: draftSchema.parse(event.payload).text,
            })
          if (event.kind === "attemptRestarted") {
            await writeChatEvent(stream, {
              type: "error",
              message:
                "Coach reconnected. Reload this Chat to see its saved reply.",
            })
            return
          }
        }
        if (
          batch.events.some(
            (event) =>
              event.kind === "action" || event.kind === "actionResolved"
          ) ||
          batch.terminal
        ) {
          const snapshot = await taskSnapshot(started.taskId, ownerId)
          const receipts = await registry.turnReceipts(ownerId, [
            snapshot.usage.id,
          ])
          for (const action of snapshot.actions) {
            const key = `${action.step}:${action.slot}:${action.state}`
            if (outcomes.has(key) || action.state === "planned") continue
            outcomes.add(key)
            const name = chatToolNameSchema.parse(action.operation)
            const confirmation = snapshot.confirmations.find(
              (item) => item.id === action.proposalId
            )
            const pending = confirmation?.status === "pending"
            const summary = confirmation?.summary ?? action.operation
            const ok =
              action.state === "committed" || action.state === "read" || pending
            const receipt = receipts.find(
              ({ result }) =>
                (action.activityId &&
                  result.activityId === action.activityId) ||
                (action.proposalId &&
                  result.pendingActionId === action.proposalId)
            )
            await writeChatEvent(stream, {
              type: "tool-call",
              toolCallId: action.toolCallId,
              name,
              input: action.input,
            })
            await writeChatEvent(
              stream,
              receipt
                ? toolResultFromExecute({
                    toolCallId: action.toolCallId,
                    name,
                    summary,
                    result: receipt.result,
                  })
                : {
                    type: "tool-result",
                    toolCallId: action.toolCallId,
                    name,
                    summary,
                    ok,
                    result: ok
                      ? {
                          ok: true,
                          data:
                            resultSchema.parse(action.result ?? {}).output ??
                            null,
                        }
                      : {
                          ok: false,
                          error: {
                            code: "CONFLICT",
                            message: "Action was not completed",
                          },
                        },
                    ...(action.activityId
                      ? { activityId: action.activityId }
                      : {}),
                    ...(pending && action.proposalId
                      ? { pendingActionId: action.proposalId }
                      : {}),
                  }
            )
            if (pending && action.proposalId)
              await writeChatEvent(stream, {
                type: "confirm",
                pendingActionId: action.proposalId,
                command: commandNameSchema.parse(name),
                summary,
              })
          }
          if (batch.terminal) {
            if (snapshot.state === "failed")
              await writeChatEvent(stream, {
                type: "error",
                message:
                  "The Coach stopped. Reload this Chat to see saved actions.",
              })
            await writeChatEvent(stream, {
              type: "message-end",
              chatId: started.chatId,
            })
            return
          }
        }
        cursor = batch.cursor
        if (batch.events.length < 100)
          await idle(Math.min(250, Math.max(0, deadline - Date.now())))
      }
    } finally {
      abort.dispose()
    }
  })
}
