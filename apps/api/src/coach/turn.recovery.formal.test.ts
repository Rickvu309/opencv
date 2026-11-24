import {
  chatDetailSchema,
  approvedProposalActor,
  coachActor,
  personActor,
  type CoachRuntime,
  type CoachStreamPart,
  type CoachTurnInput,
} from "@workspace/domain"
import { asc, eq } from "drizzle-orm"
import type { SSEStreamingApi } from "hono/streaming"
import { describe, expect, it, vi } from "vitest"

import { withDatabase } from "../db/context.js"
import { insertCoachMessage } from "../chat/index.js"
import { activity, chatMessages, coachUsage, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { coachActivityWithoutTurn } from "../test/coach-turn.js"
import { openBackend } from "../test/registry-formal-support.js"
import { runCoachTurn, toolResultFromExecute } from "./turn.js"
import { openCoachUsage } from "./usage-store.js"

vi.mock("../chat/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../chat/index.js")>()
  return { ...original, insertCoachMessage: vi.fn(original.insertCoachMessage) }
})

const quietStream = {
  aborted: false,
  onAbort: () => {},
  writeSSE: async () => {},
  write: async () => {},
} as unknown as SSEStreamingApi

const editingRuntime: CoachRuntime = {
  async *streamTurn(input: CoachTurnInput): AsyncGenerator<CoachStreamPart> {
    const execute = input.execute
    if (!execute) throw new Error("the turn gave the runtime no execute")
    yield {
      type: "tool-call",
      toolCallId: "call-0",
      name: "job.create",
      input: { title: "Role 0" },
    }
    const executed = await execute({
      name: "job.create",
      input: { title: "Role 0", company: "Acme" },
    })
    yield toolResultFromExecute({
      toolCallId: "call-0",
      name: "job.create",
      summary: "Save Role 0",
      result: executed,
    })
    yield {
      type: "finish",
      finishReason: "stop",
      usage: { model: "fake", finishReason: "stop" },
    }
  },
}

async function inChat<T>(
  body: (context: {
    db: Awaited<ReturnType<typeof openBackend>>["db"]
    registry: ReturnType<typeof installRegistry>
    chatId: string
  }) => Promise<T>
) {
  const { close, db } = await openBackend()
  try {
    await db
      .insert(user)
      .values({ id: "recovery-user", name: "Ada", email: "r@verify.local" })
    return await withDatabase(db, async () => {
      const registry = installRegistry()
      const actor = personActor("recovery-user")
      const created = await registry.execute({
        name: "chat.create",
        input: { title: "Recovery" },
        actor,
      })
      const chatId = chatDetailSchema.parse(created.output).id
      await registry.execute({
        name: "chat.appendMessage",
        input: { chatId, text: "Save this job" },
        actor,
      })
      return body({ db, registry, chatId })
    })
  } finally {
    await close()
  }
}

function nextAdmission(chatId: string) {
  return openCoachUsage({
    userId: "recovery-user",
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
}

async function coachReplies(db: Awaited<ReturnType<typeof openBackend>>["db"]) {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.role, "coach"))
    .orderBy(asc(chatMessages.createdAt))
}

describe("a Coach edit cut short still shows its receipt (C2 under crash)", () => {
  it("stamps the edit with the turn that made it", async () => {
    await inChat(async ({ db, registry, chatId }) => {
      await runCoachTurn({
        stream: quietStream,
        registry,
        runtime: editingRuntime,
        userId: "recovery-user",
        chatId,
        mode: "free",
        plan: "free",
        provider: "fake",
        modelId: "fake",
        history: [],
        heartbeatMs: 60_000,
      })
      const [usage] = await db.select().from(coachUsage)
      const rows = await db.select().from(activity)
      const edit = rows.find((row) => row.actor === "coach")
      expect(edit?.turnId).toBe(usage?.id)
      const person = rows.filter((row) => row.actor === "person")
      expect(person.every((row) => row.turnId === null)).toBe(true)
    })
  })

  it("every Coach edit made in a turn carries its turn id", async () => {
    await inChat(async ({ registry, chatId }) => {
      await runCoachTurn({
        stream: quietStream,
        registry,
        runtime: editingRuntime,
        userId: "recovery-user",
        chatId,
        mode: "free",
        plan: "free",
        provider: "fake",
        modelId: "fake",
        history: [],
        heartbeatMs: 60_000,
      })
      expect(await coachActivityWithoutTurn()).toEqual([])
    })
  })

  it("reports a Coach edit that has neither a turn id nor an approval", async () => {
    await inChat(async ({ registry, chatId }) => {
      await registry.execute({
        name: "job.create",
        input: { title: "Role 0", company: "Acme" },
        actor: approvedProposalActor("recovery-user", chatId),
      })
      expect(await coachActivityWithoutTurn()).toHaveLength(1)
    })
  })

  it("a reply that cannot be saved gets its receipt on the next admission", async () => {
    await inChat(async ({ db, registry, chatId }) => {
      vi.mocked(insertCoachMessage).mockRejectedValueOnce(
        new Error("database unavailable")
      )
      await expect(
        runCoachTurn({
          stream: quietStream,
          registry,
          runtime: editingRuntime,
          userId: "recovery-user",
          chatId,
          mode: "free",
          plan: "free",
          provider: "fake",
          modelId: "fake",
          history: [],
          heartbeatMs: 60_000,
        })
      ).rejects.toThrow("database unavailable")
      expect(await coachReplies(db)).toHaveLength(0)

      await nextAdmission(chatId)

      const [reply] = await coachReplies(db)
      const [edit] = await db
        .select()
        .from(activity)
        .where(eq(activity.actor, "coach"))
      const parts = (reply?.parts ?? []) as Array<{
        type: string
        activityId?: string
      }>
      expect(reply?.status).toBe("error")
      expect(parts.map((part) => part.activityId)).toEqual([edit?.id])
      expect(edit?.undoneAt).toBeNull()
      expect(edit?.reversalCommand).toBe("job.delete")
    })
  })

  it("a turn that died after an edit gets its receipt once its lease expires", async () => {
    await inChat(async ({ db, registry, chatId }) => {
      const turnId = await nextAdmission(chatId)
      await registry.execute({
        name: "job.create",
        input: { title: "Role 0", company: "Acme" },
        actor: coachActor("recovery-user", chatId, turnId),
      })
      await expect(nextAdmission(chatId)).rejects.toThrow(/already working/)
      expect(await coachReplies(db)).toHaveLength(0)

      await db
        .update(coachUsage)
        .set({ createdAt: new Date(Date.now() - 6 * 60_000) })
        .where(eq(coachUsage.id, turnId))
      await nextAdmission(chatId)

      const [reply] = await coachReplies(db)
      const [edit] = await db
        .select()
        .from(activity)
        .where(eq(activity.actor, "coach"))
      const parts = (reply?.parts ?? []) as Array<{ activityId?: string }>
      expect(parts.map((part) => part.activityId)).toEqual([edit?.id])
      const [recovered] = await db
        .select()
        .from(coachUsage)
        .where(eq(coachUsage.id, turnId))
      expect(recovered?.messageId).toBe(reply?.id)
    })
  })

  it("recovers a turn once, however many admissions follow", async () => {
    await inChat(async ({ db, registry, chatId }) => {
      const turnId = await nextAdmission(chatId)
      await registry.execute({
        name: "job.create",
        input: { title: "Role 0", company: "Acme" },
        actor: coachActor("recovery-user", chatId, turnId),
      })
      await db
        .update(coachUsage)
        .set({ createdAt: new Date(Date.now() - 6 * 60_000) })
        .where(eq(coachUsage.id, turnId))
      const second = await nextAdmission(chatId)
      await db
        .update(coachUsage)
        .set({ finishReason: "final" })
        .where(eq(coachUsage.id, second))
      await nextAdmission(chatId)
      expect(await coachReplies(db)).toHaveLength(1)
    })
  })
})
