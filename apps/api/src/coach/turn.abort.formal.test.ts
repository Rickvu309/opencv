import {
  chatDetailSchema,
  personActor,
  type CoachRuntime,
  type CoachStreamPart,
  type CoachTurnInput,
} from "@workspace/domain"
import { asc, eq } from "drizzle-orm"
import type { SSEStreamingApi } from "hono/streaming"
import { describe, expect, it, vi } from "vitest"

import { withDatabase } from "../db/context.js"
import { insertCoachMessage } from "./chat/index.js"
import { activity, chatMessages, coachUsage, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { openBackend } from "../test/registry-formal-support.js"
import { runCoachTurn, toolResultFromExecute } from "./turn.js"

vi.mock("./chat/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./chat/index.js")>()
  return { ...original, insertCoachMessage: vi.fn(original.insertCoachMessage) }
})

type Ending = "stop" | "provider-failure" | "none"

function controllableStream() {
  const listeners: Array<() => void> = []
  const stream = {
    aborted: false,
    onAbort: (listener: () => void) => {
      listeners.push(listener)
    },
    writeSSE: async () => {},
    write: async () => {},
  }
  return {
    stream: stream as unknown as SSEStreamingApi,
    stop() {
      stream.aborted = true
      for (const listener of listeners) listener()
    },
  }
}

async function turnWithToolEndingAs(
  ending: Ending,
  options: { saveFails?: boolean } = {}
) {
  const tools = 1
  const { close, db } = await openBackend()
  try {
    await db
      .insert(user)
      .values({ id: "formal-user", name: "Ada", email: "formal@verify.local" })
    return await withDatabase(db, async () => {
      const registry = installRegistry()
      const actor = personActor("formal-user")
      const created = await registry.execute({
        name: "chat.create",
        input: { title: "Formal" },
        actor,
      })
      const chatId = chatDetailSchema.parse(created.output).id
      await registry.execute({
        name: "chat.appendMessage",
        input: { chatId, text: "Save these jobs" },
        actor,
      })
      const { stream, stop } = controllableStream()
      const runs: Promise<unknown>[] = []
      const runtime: CoachRuntime = {
        async *streamTurn(
          input: CoachTurnInput
        ): AsyncGenerator<CoachStreamPart> {
          const execute = input.execute
          if (!execute) throw new Error("the turn gave the runtime no execute")
          for (let index = 0; index < tools; index += 1) {
            const toolCallId = `call-${index}`
            yield {
              type: "tool-call",
              toolCallId,
              name: "job.create",
              input: { title: `Role ${index}` },
            }
            const running = execute({
              name: "job.create",
              input: { title: `Role ${index}`, company: "Acme" },
            })
            runs.push(running)
            if (ending === "stop") stop()
            if (ending === "provider-failure")
              yield { type: "error", message: "provider failed" }
            const executed = await running
            yield toolResultFromExecute({
              toolCallId,
              name: "job.create",
              summary: `Save Role ${index}`,
              result: executed,
            })
          }
          yield {
            type: "finish",
            finishReason: "stop",
            usage: { model: "fake", finishReason: "stop" },
          }
        },
      }
      if (options.saveFails)
        vi.mocked(insertCoachMessage).mockRejectedValueOnce(
          new Error("database unavailable")
        )
      const outcome = await runCoachTurn({
        stream,
        registry,
        runtime,
        userId: "formal-user",
        chatId,
        mode: "free",
        plan: "free",
        provider: "fake",
        modelId: "fake",
        history: [],
        heartbeatMs: 60_000,
      }).then(
        () => "saved",
        (error: Error) => error.message
      )
      await Promise.allSettled(runs)
      const usage = await db.select().from(coachUsage)
      const [reply] = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.role, "coach"))
      const rows = await db
        .select()
        .from(activity)
        .where(eq(activity.actor, "coach"))
        .orderBy(asc(activity.createdAt))
      const parts = (reply?.parts ?? []) as Array<{
        type: string
        activityId?: string
      }>
      return { reply, rows, parts, usage, outcome }
    })
  } finally {
    await close()
  }
}

describe("Coach turn lifecycle, stop receipt (C2)", () => {
  it("control: a turn nobody stops records the receipt of the edit it made", async () => {
    const { reply, rows, parts } = await turnWithToolEndingAs("none")
    expect(reply?.status).toBe("final")
    expect(rows).toHaveLength(1)
    expect(parts.map((part) => part.activityId)).toEqual([rows[0]?.id])
  })

  it("Stop during an edit: the saved reply holds a receipt for every edit that committed", async () => {
    const { reply, rows, parts } = await turnWithToolEndingAs("stop")
    expect(reply?.status).toBe("aborted")
    expect(rows).toHaveLength(1)
    const receipts = parts.flatMap((part) =>
      part.activityId ? [part.activityId] : []
    )
    expect(receipts).toEqual(rows.map((row) => row.id))
  })

  it("Stop during an edit: Undo is still offered for the edit", async () => {
    const { rows } = await turnWithToolEndingAs("stop")
    expect(rows[0]?.reversalCommand).toBe("job.delete")
    expect(rows[0]?.undoneAt).toBeNull()
  })

  it("a provider failure while an edit commits still records its receipt", async () => {
    const { reply, rows, parts } =
      await turnWithToolEndingAs("provider-failure")
    expect(reply?.status).toBe("error")
    expect(rows).toHaveLength(1)
    const receipts = parts.flatMap((part) =>
      part.activityId ? [part.activityId] : []
    )
    expect(receipts).toEqual(rows.map((row) => row.id))
  })

  it("a reply that cannot be saved still releases the chat for the next turn (C3)", async () => {
    const { usage, outcome } = await turnWithToolEndingAs("none", {
      saveFails: true,
    })
    expect(outcome).toBe("database unavailable")
    expect(usage).toHaveLength(1)
    expect(usage[0]?.finishReason).not.toBeNull()
  })
})
