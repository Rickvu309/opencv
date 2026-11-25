import { randomUUID } from "node:crypto"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { eq, sql } from "drizzle-orm"
import { createApp } from "../app.js"
import { withDatabase } from "../db/context.js"
import { chatMessages, coachTasks, pendingActions } from "../db/schema.js"
import { installRegistry } from "../install.js"
import {
  authHeaders,
  commandAs,
  readAs,
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
  run: (ctx: Awaited<ReturnType<typeof setup>>) => Promise<void>,
  options: { coachDurable?: boolean; coachCompatibilityMs?: number } = {}
) {
  process.env.COACH_DURABLE = "on"
  process.env.COACH_RUNTIME = "fake"
  const ctx = await setup(options)
  try {
    await withDatabase(ctx.db, () => run(ctx))
  } finally {
    await ctx.client.close()
  }
}

async function setup(options: {
  coachDurable?: boolean
  coachCompatibilityMs?: number
}) {
  const { db, client } = await createMigratedTestDb()
  const legacy = createScriptedCoachRuntime([])
  const inference = vi.spyOn(legacy, "streamTurn")
  const app = createTestApp(db, { coach: legacy, ...options })
  const owner = await signUp(app, {
    name: "Ada",
    email: `${randomUUID()}@example.com`,
  })
  const response = await app.request("/api/commands/chat.create", {
    method: "POST",
    headers: authHeaders(owner.cookie),
    body: JSON.stringify({ title: "Old tab" }),
  })
  const chatId = z
    .object({ data: z.object({ id: z.string() }) })
    .parse(await response.json()).data.id
  const registry = installRegistry()
  const runtime = vi.fn(() => createScriptedWorkerRuntime([final]))
  const work = () =>
    runCoachWorker({
      registry,
      workerId: "old-tab",
      runtime,
      catalogDigest: taskCatalogDigest(registry),
      runtimeVersion: COACH_TASK_RUNTIME_VERSION,
      scheduleRenewal: () => () => {},
    })
  return { db, client, app, owner, chatId, runtime, work, inference }
}

it("adapts old tabs to durable work and returns the old wire events and final saved reply", () =>
  fixture(
    async ({ app, owner, chatId, work, inference, db, runtime }) => {
      runtime.mockImplementation(() =>
        createScriptedWorkerRuntime([
          {
            ...final,
            text: "Reading. ",
            intents: [{ id: "read_jobs", name: "job.list", input: {} }],
          },
          final,
        ])
      )
      const response = await app.request(`/api/chats/${chatId}/turns`, {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ text: "Prepare from an old tab" }),
      })
      const wire = response.text()
      expect(response.status).toBe(200)
      await work()
      const text = await wire
      expect(text).toContain("event: message-start")
      expect(text).toContain("event: tool-call")
      expect(text).toContain("event: tool-result")
      expect(text).toContain("job.list")
      expect(text).toContain("event: text-delta")
      expect(text).toContain("event: message-end")
      expect(inference).not.toHaveBeenCalled()
      const tasks = await db.select().from(coachTasks)
      expect(tasks).toHaveLength(1)
      expect(tasks[0]?.state).toBe("succeeded")
      expect(
        (await db.select().from(chatMessages)).filter(
          (message) => message.role === "coach"
        )
      ).toHaveLength(1)
    },
    { coachDurable: true }
  ))

it("sends a pending result the old tab can read", () =>
  fixture(
    async ({ app, owner, chatId, runtime, work }) => {
      const command = (name: string, input: unknown) =>
        app.request(`/api/commands/${name}`, {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify(input),
        })
      const created = await command("job.create", {
        title: "Role",
        company: "Acme",
      })
      const jobId = z
        .object({ data: z.object({ id: z.string() }) })
        .parse(await created.json()).data.id
      runtime.mockImplementation(() =>
        createScriptedWorkerRuntime([
          {
            ...final,
            intents: [{ id: "delete", name: "job.delete", input: { jobId } }],
          },
          final,
        ])
      )
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now())
      const controller = new AbortController()
      try {
        const response = await app.request(`/api/chats/${chatId}/turns`, {
          method: "POST",
          signal: controller.signal,
          headers: authHeaders(owner.cookie),
          body: JSON.stringify({ text: "Delete the Job" }),
        })
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let text = ""
        try {
          await work()
          while (!text.includes("event: confirm")) {
            const chunk = await reader.read()
            if (chunk.done) break
            text += decoder.decode(chunk.value, { stream: true })
          }
        } finally {
          controller.abort()
          await reader.cancel()
        }
        expect(text).toContain("event: tool-result")
        expect(text).toContain("pendingActionId")
        expect(text).toContain("event: confirm")
        expect(text).not.toContain("The Coach stopped")
      } finally {
        controller.abort()
        clock.mockRestore()
      }
    },
    { coachDurable: true, coachCompatibilityMs: 1000 }
  ))

it("keeps committed receipts and Undo in the old wire format", () =>
  fixture(
    async ({ app, owner, chatId, runtime, work }) => {
      runtime.mockImplementation(() =>
        createScriptedWorkerRuntime([
          {
            ...final,
            intents: [
              {
                id: "create_job",
                name: "job.create",
                input: { title: "Role", company: "Acme" },
              },
            ],
          },
          final,
        ])
      )
      const response = await app.request(`/api/chats/${chatId}/turns`, {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ text: "Save this Job" }),
      })
      const wire = response.text()
      await work()
      const text = await wire
      expect(text).toContain("event: tool-call")
      expect(text).toContain("event: tool-result")
      expect(text).toContain('"activityId":')
      expect(text).toContain('"reversal":{"possible":true')
      expect(text).toContain("event: message-end")
    },
    { coachDurable: true }
  ))

it("keeps durable work after an old tab disconnects", () =>
  fixture(
    async ({ app, owner, chatId, work, db, inference }) => {
      const controller = new AbortController()
      const response = await app.request(`/api/chats/${chatId}/turns`, {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ text: "Keep working" }),
        signal: controller.signal,
      })
      const reader = response.body!.getReader()
      await reader.read()
      controller.abort()
      await reader.cancel()
      await work()
      expect((await db.select().from(coachTasks))[0]?.state).toBe("succeeded")
      expect(inference).not.toHaveBeenCalled()
    },
    { coachDurable: true }
  ))

it("bounds an old tab tail without cancelling its queued task", () =>
  fixture(
    async ({ app, owner, chatId, db, work }) => {
      const response = await app.request(`/api/chats/${chatId}/turns`, {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ text: "Outlive this connection" }),
      })
      const wire = await response.text()
      const events = wire
        .split("\n\n")
        .filter((frame) => frame.includes("event: "))
        .map((frame) => ({
          event: /event: (.+)/.exec(frame)?.[1],
          data: /data: (.+)/.exec(frame)?.[1] ?? "",
        }))
      expect(events.map((frame) => frame.event)).toEqual([
        "message-start",
        "notice",
        "message-end",
      ])
      expect(JSON.parse(events[1]!.data)).toEqual({
        text: "Coach is still working. Reload this Chat to follow or stop it.",
      })
      expect(
        events.filter(
          (frame) =>
            frame.event === "text-delta" && frame.data.includes("still working")
        )
      ).toEqual([])
      expect(wire).not.toContain("event: error")
      const detail = await app.request(
        readAs(owner.cookie, "chat.get", { chatId })
      )
      expect(await detail.json()).toMatchObject({
        data: {
          messages: expect.arrayContaining([
            expect.objectContaining({
              text: "Coach is still working. Reload this Chat to follow or stop it.",
            }),
          ]),
        },
      })
      expect(wire).not.toMatch(/retry|try again/i)
      expect((await db.select().from(coachTasks))[0]?.state).toBe("queued")
      await work()
      expect((await db.select().from(coachTasks))[0]?.state).toBe("succeeded")
    },
    { coachDurable: true, coachCompatibilityMs: 20 }
  ))

it("publishes the same server-owned mode used by the old wire route without caching", () =>
  fixture(
    async ({ app }) => {
      const response = await app.request("/api/public-config")
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      expect(await response.json()).toMatchObject({ coachDurable: true })
    },
    { coachDurable: true }
  ))

it("defaults the deployed API to durable and serves the kill switch without a web build", async () => {
  delete process.env.COACH_DURABLE
  const on = createApp({ webOrigins: [] })
  expect(await (await on.request("/api/public-config")).json()).toMatchObject({
    coachDurable: true,
  })
  process.env.COACH_DURABLE = "off"
  const off = createApp({ webOrigins: [] })
  expect(await (await off.request("/api/public-config")).json()).toMatchObject({
    coachDurable: false,
  })
})

for (const state of [
  "queued",
  "running",
  "waitingApproval",
  "cancelling",
] as const) {
  it(`drains ${state} work after rollback and admits legacy only after it ends`, () =>
    fixture(async ({ app, db, owner, chatId, work }) => {
      const command = (name: string, input: unknown) =>
        app.request(`/api/commands/${name}`, {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify(input),
        })
      const input = {
        chatId,
        text: "Accepted before rollback",
        startKey: randomUUID(),
      }
      const started = await command("coach.start", input)
      expect(started.status).toBe(200)
      const [task] = await db.select().from(coachTasks)
      await db
        .update(coachTasks)
        .set({
          state,
          leaseOwner: state === "running" ? "killed-api" : null,
          leaseUntil:
            state === "running"
              ? sql`clock_timestamp() - interval '1 second'`
              : null,
          cancelRequestedAt: state === "cancelling" ? new Date() : null,
        })
        .where(eq(coachTasks.id, task!.id))
      process.env.COACH_DURABLE = "off"
      const replay = await command("coach.start", input)
      expect(replay.status).toBe(200)
      expect(await replay.json()).toMatchObject({
        data: { taskId: task!.id },
      })
      const legacy = createTestApp(db, {
        coach: createScriptedCoachRuntime([]),
        coachDurable: false,
      })
      const turn = () =>
        legacy.request(`/api/chats/${chatId}/turns`, {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify({ text: "Legacy after rollback" }),
        })
      expect((await turn()).status).toBe(409)
      const read = await legacy.request(
        readAs(owner.cookie, "coach.status", { taskId: task!.id })
      )
      expect(read.status).toBe(200)
      const detail = await legacy.request(
        readAs(owner.cookie, "chat.get", { chatId })
      )
      expect(await detail.json()).toMatchObject({
        data: { activeTaskId: task!.id },
      })
      expect(
        (
          await command("coach.start", {
            chatId,
            text: "New durable",
            startKey: randomUUID(),
          })
        ).status
      ).toBe(404)
      expect(await work()).toBe(true)
      expect((await db.select().from(coachTasks))[0]?.state).toBe(
        state === "cancelling" ? "cancelled" : "succeeded"
      )
      const response = await turn()
      expect(response.status).toBe(200)
      expect(await response.text()).toContain("event: message-end")
    }))
}

it.each([false, true])(
  "old Stop cancels durable work after tail closure %s",
  (afterTail) =>
    fixture(
      async ({ app, db, owner, chatId, work }) => {
        const response = await app.request(`/api/chats/${chatId}/turns`, {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify({ text: "Stop this durable reply" }),
        })
        expect((await db.select().from(coachTasks))[0]?.startKey).toMatch(
          /^legacy-tab:/
        )
        const wire = response.text()
        if (afterTail) await wire
        const stop = await app.request(
          commandAs(owner.cookie, "coach.stop", { chatId })
        )
        expect(stop.status).toBe(200)
        expect(await stop.json()).toMatchObject({ data: { stopped: true } })
        expect((await db.select().from(coachTasks))[0]?.state).toBe(
          "cancelling"
        )
        await work()
        expect((await db.select().from(coachTasks))[0]?.state).toBe("cancelled")
        await wire
      },
      { coachDurable: true, coachCompatibilityMs: 20 }
    )
)

it.each(["approve", "deny", "stop"] as const)(
  "resolves a real waiting proposal after rollback: %s",
  (resolution) =>
    fixture(async ({ app, db, owner, chatId, runtime, work }) => {
      const command = (name: string, input: unknown) =>
        app.request(`/api/commands/${name}`, {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify(input),
        })
      const created = await command("job.create", {
        title: "Role",
        company: "Acme",
      })
      const jobId = z
        .object({ data: z.object({ id: z.string() }) })
        .parse(await created.json()).data.id
      runtime.mockImplementation(() =>
        createScriptedWorkerRuntime([
          {
            ...final,
            intents: [{ id: "delete", name: "job.delete", input: { jobId } }],
          },
          final,
        ])
      )
      await command("coach.start", {
        chatId,
        text: "Delete the Job",
        startKey: randomUUID(),
      })
      await work()
      expect((await db.select().from(coachTasks))[0]?.state).toBe(
        "waitingApproval"
      )
      const [proposal] = await db.select().from(pendingActions)
      process.env.COACH_DURABLE = "off"
      const legacy = createTestApp(db, {
        coach: createScriptedCoachRuntime([]),
        coachDurable: false,
      })
      const resolved = await legacy.request(
        resolution === "stop"
          ? `/api/commands/coach.stop`
          : `/api/commands/actions.${resolution}`,
        {
          method: "POST",
          headers: authHeaders(owner.cookie),
          body: JSON.stringify(
            resolution === "stop"
              ? { chatId, taskId: (await db.select().from(coachTasks))[0]!.id }
              : { pendingActionId: proposal!.id }
          ),
        }
      )
      expect(resolved.status).toBe(200)
      await work()
      expect((await db.select().from(coachTasks))[0]?.state).toBe(
        resolution === "stop" ? "cancelled" : "succeeded"
      )
      expect((await db.select().from(pendingActions))[0]?.status).toBe(
        resolution === "approve" ? "approved" : "denied"
      )
      const response = await legacy.request(`/api/chats/${chatId}/turns`, {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ text: "Continue in legacy" }),
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain("event: message-end")
    })
)

it("keeps a newer client task running when a delayed old Stop arrives after rollback", () =>
  fixture(
    async ({ app, db, owner, chatId, work }) => {
      const response = await app.request(`/api/chats/${chatId}/turns`, {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ text: "Reply A from an old tab" }),
      })
      const delayedStop = commandAs(owner.cookie, "coach.stop", { chatId })
      await response.text()
      await work()
      const [a] = await db.select().from(coachTasks)
      expect(a?.state).toBe("succeeded")
      const started = await app.request("/api/commands/coach.start", {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({
          chatId,
          startKey: randomUUID(),
          text: "Reply B",
        }),
      })
      expect(started.status).toBe(200)
      const b = z
        .object({ data: z.object({ taskId: z.string() }) })
        .parse(await started.json()).data
      process.env.COACH_DURABLE = "off"
      const control = await app.request("/api/commands/coach.stop", {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ chatId, taskId: a!.id }),
      })
      expect(await control.json()).toMatchObject({ data: { stopped: false } })
      const stopped = await app.request(delayedStop)
      expect(stopped.status).toBe(200)
      expect(await stopped.json()).toMatchObject({ data: { stopped: false } })
      expect(
        (await db.select().from(coachTasks).where(eq(coachTasks.id, a!.id)))[0]
          ?.state
      ).toBe("succeeded")
      expect(
        (
          await db.select().from(coachTasks).where(eq(coachTasks.id, b.taskId))
        )[0]?.state
      ).toBe("queued")
      await work()
      expect(
        (
          await db.select().from(coachTasks).where(eq(coachTasks.id, b.taskId))
        )[0]?.state
      ).toBe("succeeded")
    },
    { coachDurable: true, coachCompatibilityMs: 0 }
  ))

it("makes old Stop a no-op with only new-client work and reserves legacy-tab start keys", () =>
  fixture(async ({ app, owner, chatId, db }) => {
    const start = (startKey: string) =>
      app.request("/api/commands/coach.start", {
        method: "POST",
        headers: authHeaders(owner.cookie),
        body: JSON.stringify({ chatId, startKey, text: "New client" }),
      })
    expect((await start(`legacy-tab:${randomUUID()}`)).status).toBe(400)
    expect((await start(randomUUID())).status).toBe(200)
    const stopped = await app.request(
      commandAs(owner.cookie, "coach.stop", { chatId })
    )
    expect(stopped.status).toBe(200)
    expect(await stopped.json()).toMatchObject({ data: { stopped: false } })
    const [task] = await db.select().from(coachTasks)
    expect(task?.state).toBe("queued")
    expect(task?.cancelRequestedAt).toBeNull()
  }))
