import { randomUUID } from "node:crypto"
import {
  coachStartOutputSchema,
  chatDetailSchema,
  coachTaskEventSchema,
  coachTaskReplaySchema,
  coachTaskSnapshotSchema,
  type CoachStartInput,
} from "@workspace/domain/coach"
import { chatIdSchema } from "@workspace/domain/kernel"
import { and, eq } from "drizzle-orm"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { withDatabase } from "../db/context.js"
import {
  chatMessages,
  coachTasks,
  coachUsage,
  taskEvents,
  user,
} from "../db/schema.js"
import { installRegistry } from "../install.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import {
  createScriptedCoachRuntime,
  createScriptedWorkerRuntime,
} from "./fake.js"
import { COACH_TASK_RUNTIME_VERSION, taskCatalogDigest } from "./task-start.js"
import { runCoachWorker } from "./worker.js"

const coachTaskResetSchema = coachTaskReplaySchema.options[1]
const envelope = z.object({ ok: z.literal(true), data: z.unknown() })
const originalSwitch = process.env.COACH_DURABLE
const originalRuntime = process.env.COACH_RUNTIME
const final = {
  text: "Prepared.",
  intents: [],
  inputTokens: 2,
  outputTokens: 3,
}

afterEach(() => {
  if (originalSwitch === undefined) delete process.env.COACH_DURABLE
  else process.env.COACH_DURABLE = originalSwitch
  if (originalRuntime === undefined) delete process.env.COACH_RUNTIME
  else process.env.COACH_RUNTIME = originalRuntime
})

async function fixture(
  run: (ctx: Awaited<ReturnType<typeof setup>>) => Promise<void>
) {
  process.env.COACH_DURABLE = "on"
  process.env.COACH_RUNTIME = "fake"
  const ctx = await setup()
  try {
    await withDatabase(ctx.db, () => run(ctx))
  } finally {
    await ctx.client.close()
  }
}

async function setup() {
  const { db, client } = await createMigratedTestDb()
  const legacy = createScriptedCoachRuntime([])
  const inference = vi.spyOn(legacy, "streamTurn")
  const app = createTestApp(db, { coach: legacy })
  const owner = await signUp(app, {
    name: "Ada",
    email: `${randomUUID()}@example.com`,
  })
  const foreign = await signUp(app, {
    name: "Grace",
    email: `${randomUUID()}@example.com`,
  })
  const [person] = await db
    .select()
    .from(user)
    .where(eq(user.email, owner.user.email))
  if (!person) throw new Error("Owner missing")
  const command = (name: string, input: unknown, cookie = owner.cookie) =>
    app.request(`/api/commands/${name}`, {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify(input),
    })
  const created = await command("chat.create", { title: "HTTP Coach task" })
  const chatId = z
    .object({ id: chatIdSchema })
    .parse(envelope.parse(await created.json()).data).id
  const start = async (input: Partial<CoachStartInput> = {}) => {
    const res = await command("coach.start", {
      chatId,
      startKey: randomUUID(),
      text: "Help me prepare",
      ...input,
    })
    expect(res.status).toBe(200)
    return coachStartOutputSchema.parse(envelope.parse(await res.json()).data)
  }
  const status = async (taskId: string) => {
    const res = await app.request("/api/reads/coach.status", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({ taskId }),
    })
    expect(res.status).toBe(200)
    return coachTaskSnapshotSchema.parse(envelope.parse(await res.json()).data)
  }
  const registry = installRegistry()
  const runtime = vi.fn(() => createScriptedWorkerRuntime([final]))
  const work = () =>
    runCoachWorker({
      registry,
      workerId: "http-test",
      runtime,
      catalogDigest: taskCatalogDigest(registry),
      runtimeVersion: COACH_TASK_RUNTIME_VERSION,
      scheduleRenewal: () => () => {},
    })
  const events = (
    taskId: string,
    after: number,
    cookie = owner.cookie,
    signal?: AbortSignal
  ) =>
    app.request(
      new Request(
        `http://localhost/api/coach/tasks/${taskId}/events?after=${after}`,
        { headers: authHeaders(cookie), signal }
      )
    )
  return {
    db,
    client,
    app,
    command,
    start,
    status,
    work,
    runtime,
    events,
    owner,
    foreign,
    chatId,
    ownerId: person.id,
    inference,
  }
}

function parseEvents(wire: string) {
  return wire
    .split("\n\n")
    .filter((block) => block.includes("event: task"))
    .map((block) => {
      const data = block
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6)
      const event = coachTaskEventSchema.parse(JSON.parse(data ?? "null"))
      expect(block).toContain(`id: ${event.seq}`)
      return event
    })
}

it("admits once, returns a durable receipt before inference and rejects reused start keys or overlapping work", () =>
  fixture(async ({ start, command, db, chatId, inference, runtime }) => {
    const input = { startKey: randomUUID(), text: "Prepare", chatId }
    const first = await start(input)
    expect(await start(input)).toEqual(first)
    expect(inference).not.toHaveBeenCalled()
    expect(runtime).not.toHaveBeenCalled()
    expect(await db.select().from(coachTasks)).toHaveLength(1)
    expect(await db.select().from(coachUsage)).toHaveLength(1)
    expect(await db.select().from(chatMessages)).toHaveLength(1)
    const [event] = await db.select().from(taskEvents)
    expect(event?.payload).toEqual({ state: "queued", receipt: first.receipt })
    expect(
      (await command("coach.start", { ...input, text: "Changed" })).status
    ).toBe(409)
    expect(
      (await command("coach.start", { ...input, startKey: randomUUID() }))
        .status
    ).toBe(409)
  }))

it("keeps a snapshot and cursor together, replays strictly after it and catches up on another connection", () =>
  fixture(
    async ({ start, status, work, events, app, owner, foreign, chatId }) => {
      const { taskId } = await start()
      const chat = await app.request("/api/reads/chat.get", {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ chatId: chatId }),
      })
      expect(
        chatDetailSchema.parse(envelope.parse(await chat.json()).data)
          .activeTaskId
      ).toBe(taskId)
      expect(
        (
          await app.request("/api/reads/chat.get", {
            method: "POST",
            headers: authHeaders(foreign.cookie),
            body: JSON.stringify({ chatId: chatId }),
          })
        ).status
      ).toBe(404)
      const before = await status(taskId)
      expect(before.cursor).toBe(0)
      expect(before.events.map((event) => event.seq)).toEqual([0])
      await work()
      const finished = await app.request("/api/reads/chat.get", {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ chatId: chatId }),
      })
      expect(
        chatDetailSchema.parse(envelope.parse(await finished.json()).data)
          .activeTaskId
      ).toBeNull()
      const after = await status(taskId)
      expect(after.state).toBe("succeeded")
      expect(after.events.at(-1)?.seq).toBe(after.cursor)
      const res = await events(taskId, before.cursor)
      const replay = parseEvents(await res.text())
      expect(replay).toEqual(
        after.events.filter((event) => event.seq > before.cursor)
      )
      expect(replay.map((event) => event.seq)).toEqual(
        Array.from({ length: after.cursor }, (_, index) => index + 1)
      )
      const reload = await app.request(
        `/api/coach/tasks/${taskId}/events?after=-1`,
        {
          headers: {
            ...authHeaders(owner.cookie),
            "Last-Event-ID": String(after.cursor),
          },
        }
      )
      expect(parseEvents(await reload.text())).toEqual([])
    }
  ))

it("recovers messages, usage and action input identities when event history expires", () =>
  fixture(async ({ start, runtime, work, status, db, events }) => {
    runtime.mockImplementation(() =>
      createScriptedWorkerRuntime([
        {
          ...final,
          intents: [{ id: "profile-read", name: "profile.get", input: {} }],
        },
        final,
      ])
    )
    const { taskId } = await start()
    await work()
    const snapshot = await status(taskId)
    expect(snapshot.state).toBe("succeeded")
    expect(snapshot.messages.map((message) => message.role)).toEqual([
      "person",
      "coach",
    ])
    expect(snapshot.actions).toEqual([
      expect.objectContaining({
        operation: "profile.get",
        input: {},
        toolCallId: "profile-read",
        state: "read",
      }),
    ])
    expect(snapshot.usage).toMatchObject({ inputTokens: 4, outputTokens: 6 })
    expect(snapshot.usage.finishReason).not.toBeNull()
    expect(snapshot.confirmations).toEqual([])
    await db.delete(taskEvents).where(eq(taskEvents.taskId, taskId))
    const response = await events(taskId, -1)
    expect(response.status).toBe(409)
    const reset = coachTaskResetSchema.parse(await response.json())
    expect(reset.snapshot.messages).toEqual(snapshot.messages)
    expect(reset.snapshot.actions).toEqual(snapshot.actions)
    expect(reset.snapshot.usage).toEqual(snapshot.usage)
    expect(reset.snapshot.cursor).toBe(snapshot.cursor)
  }))

it("streams live events and leaves work running when the connection disconnects", () =>
  fixture(async ({ start, status, work, events, runtime }) => {
    const { taskId } = await start()
    const abort = new AbortController()
    const res = await events(taskId, -1, undefined, abort.signal)
    const reader = res.body!.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "event: task"
    )
    abort.abort()
    await reader.cancel()
    expect((await status(taskId)).cancelRequestedAt).toBeNull()
    await work()
    expect(runtime).toHaveBeenCalledOnce()
    expect((await status(taskId)).state).toBe("succeeded")
  }))

it("tails an open connection after replay and closes at the terminal cursor", () =>
  fixture(async ({ start, events, work, status }) => {
    const { taskId } = await start()
    const res = await events(taskId, -1)
    const wire = res.text()
    await work()
    const snapshot = await status(taskId)
    expect(parseEvents(await wire)).toEqual(snapshot.events)
  }))

it("checks the owner on every status, replay and Stop connection", () =>
  fixture(async ({ start, status, events, app, command, foreign, chatId }) => {
    const { taskId } = await start()
    expect(
      (
        await app.request("/api/reads/coach.status", {
          method: "POST",
          headers: authHeaders(foreign.cookie),
          body: JSON.stringify({ taskId }),
        })
      ).status
    ).toBe(404)
    expect((await events(taskId, -1, foreign.cookie)).status).toBe(404)
    expect(
      (await command("coach.stop", { chatId, taskId }, foreign.cookie)).status
    ).toBe(404)
    expect(
      (
        await command(
          "coach.start",
          { chatId, startKey: randomUUID(), text: "Foreign start" },
          foreign.cookie
        )
      ).status
    ).toBe(404)
    expect(
      (
        await app.request("/api/reads/coach.status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        })
      ).status
    ).toBe(401)
    expect((await status(taskId)).cancelRequestedAt).toBeNull()
  }))

it("commits explicit Stop durably and does not call inference for the cancelled task", () =>
  fixture(async ({ start, status, command, chatId, work, runtime }) => {
    const { taskId } = await start()
    expect((await command("coach.stop", { chatId, taskId })).status).toBe(200)
    const stopping = await status(taskId)
    expect(stopping.state).toBe("cancelling")
    expect(stopping.cancelRequestedAt).not.toBeNull()
    await work()
    expect(runtime).not.toHaveBeenCalled()
    expect((await status(taskId)).state).toBe("cancelled")
  }))

it("returns typed resets for expired, missing and future cursors", () =>
  fixture(async ({ start, work, events, db, status }) => {
    const { taskId } = await start()
    await work()
    const snapshot = await status(taskId)
    expect(snapshot.cursor).toBeGreaterThanOrEqual(2)
    const ahead = await events(taskId, snapshot.cursor + 1)
    expect(ahead.status).toBe(409)
    expect(coachTaskResetSchema.parse(await ahead.json()).reason).toBe("ahead")
    await db
      .delete(taskEvents)
      .where(and(eq(taskEvents.taskId, taskId), eq(taskEvents.seq, 1)))
    const gap = await events(taskId, 0)
    expect(gap.status).toBe(409)
    expect(coachTaskResetSchema.parse(await gap.json()).reason).toBe("gap")
    await db
      .delete(taskEvents)
      .where(and(eq(taskEvents.taskId, taskId), eq(taskEvents.seq, 0)))
    const expired = await events(taskId, -1)
    expect(expired.status).toBe(409)
    const reset = coachTaskResetSchema.parse(await expired.json())
    expect(reset.reason).toBe("expired")
    expect(reset.snapshot.cursor).toBe(snapshot.cursor)
  }))

it("rejects malformed cursors and keeps accepted tasks readable after rollback", () =>
  fixture(async ({ app, owner, start, command, chatId, events }) => {
    const { taskId } = await start()
    for (const after of ["-2", "1.5", "NaN", "9007199254740992", "1e3", ""]) {
      expect(
        (
          await app.request(
            `/api/coach/tasks/${taskId}/events?after=${after}`,
            { headers: authHeaders(owner.cookie) }
          )
        ).status
      ).toBe(400)
    }
    process.env.COACH_DURABLE = "off"
    expect(
      (
        await command("coach.start", {
          chatId,
          startKey: randomUUID(),
          text: "Prepare",
        })
      ).status
    ).toBe(404)
    expect(
      (
        await app.request("/api/reads/coach.status", {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify({ taskId }),
        })
      ).status
    ).toBe(200)
    expect((await events(taskId, -1)).status).toBe(200)
  }))

it("regenerates the same source with selection and grounding and never offers tools", () =>
  fixture(async ({ start, work, db, status }) => {
    const first = await start({
      selection: { text: "Selected text", sectionId: "intro" },
    })
    await work()
    const prior = await status(first.taskId)
    const next = await start({ regenerate: true, text: undefined })
    const [task] = await db
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, next.taskId))
    expect(task?.sourceMessageId).toBe(prior.sourceMessageId)
    expect(task?.supersedesMessageId).toBe(prior.assistantMessageId)
    expect(task?.toolsAllowed).toBe(false)
    expect(task?.contextSnapshot).toMatchObject({
      selection: { text: "Selected text", sectionId: "intro" },
      regenerate: true,
    })
    const tools = vi.spyOn(installRegistry(), "tools")
    try {
      await work()
      expect(tools).not.toHaveBeenCalled()
    } finally {
      tools.mockRestore()
    }
    expect((await status(next.taskId)).state).toBe("succeeded")
    const stored = await db.select().from(chatMessages)
    expect(stored.filter((message) => message.role === "person")).toHaveLength(
      1
    )
    const completed = await status(next.taskId)
    expect(
      stored.find((message) => message.id === completed.assistantMessageId)
        ?.supersedesMessageId
    ).toBe(prior.assistantMessageId)
  }))

it("starts a text-only turn, such as Letter drafting, that offers the Coach no actions", () =>
  fixture(async ({ start, work, db, status }) => {
    const drafted = await start({
      textOnly: true,
      text: "Make me a CV and draft a cover letter. Reply with the letter text only.",
    })
    const [task] = await db
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, drafted.taskId))
    expect(task?.toolsAllowed).toBe(false)
    const tools = vi.spyOn(installRegistry(), "tools")
    try {
      await work()
      expect(tools).not.toHaveBeenCalled()
    } finally {
      tools.mockRestore()
    }
    expect((await status(drafted.taskId)).state).toBe("succeeded")
  }))

it("exposes the same owned reader through the domain query registry", () =>
  fixture(async ({ start, ownerId, status, work }) => {
    const { personActor } = await import("@workspace/domain")
    const registry = installRegistry()
    const { taskId } = await start()
    expect(
      await registry.read("coach.status", { taskId }, personActor(ownerId))
    ).toEqual(await status(taskId))
    const replay = coachTaskReplaySchema.parse(
      await registry.read(
        "coach.events",
        { taskId, after: -1 },
        personActor(ownerId)
      )
    )
    expect(replay.type).toBe("events")
    await work()
  }))

it("shows only a public error code when a task fails with internal error text", () =>
  fixture(async ({ start, runtime, work, status }) => {
    runtime.mockImplementation(() => {
      throw new Error("select secret_column from internal_table")
    })
    const { taskId } = await start()
    await work()
    const snapshot = await status(taskId)
    expect(snapshot.state).toBe("failed")
    expect(snapshot.errorCode).toBe("TASK_FAILED")
    expect(JSON.stringify(snapshot)).not.toContain("secret_column")
  }))

it("targets the exact task across terminal completion, replay and a newer turn", () =>
  fixture(async ({ start, command, work, status, chatId, foreign }) => {
    const input = { chatId, startKey: randomUUID(), text: "Original" }
    const original = await start(input)
    await work()
    expect((await status(original.taskId)).state).toBe("succeeded")
    const newer = await start({ text: "Newer" })
    expect(await start(input)).toEqual(original)
    expect(
      (
        await command(
          "coach.stop",
          { chatId, taskId: newer.taskId },
          foreign.cookie
        )
      ).status
    ).toBe(404)
    const stale = await command("coach.stop", {
      chatId,
      taskId: original.taskId,
    })
    expect(stale.status).toBe(200)
    expect(envelope.parse(await stale.json()).data).toEqual({ stopped: false })
    expect((await status(newer.taskId)).state).toBe("queued")
    expect(
      (await command("coach.stop", { chatId, taskId: newer.taskId })).status
    ).toBe(200)
    expect((await status(newer.taskId)).state).toBe("cancelling")
    expect(
      (await command("coach.stop", { chatId, taskId: newer.taskId })).status
    ).toBe(200)
  }))
