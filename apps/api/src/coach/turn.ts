import {
  appendCoachPart,
  COACH_SSE_EVENTS,
  coachProviderErrorMessage,
  textFromParts,
  type CoachFocusDoc,
  type CoachMode,
  type CoachRuntime,
  type CoachSelection,
  type CoachSseErrorData,
  type CoachSseMessageEndData,
  type CoachSseMessageStartData,
  type CoachStreamPart,
  type CoachTurnUsage,
  type ThreadMessage,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import type { SSEStreamingApi } from "hono/streaming"

import type { AppDatabase, CommandRegistry } from "../commands/registry.js"
import { coachUsage, threadMessages, threads } from "../db/schema.js"
import { createId } from "../id.js"
import { toThreadMessage } from "../threads/queries.js"
import {
  isDisconnected,
  sseDataForPart,
  takeUntilAbort,
  waitForAbort,
  writeEvent,
  writeHeartbeat,
} from "./sse.js"
import { maybeAutoTitleThread } from "./title.js"

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
  selection?: CoachSelection
  heartbeatMs: number
  signal?: AbortSignal
}

export async function runCoachTurn({
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
  selection,
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
        selection,
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
      const message = coachProviderErrorMessage(error, mode)
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
