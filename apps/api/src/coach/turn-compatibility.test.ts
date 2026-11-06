import { randomUUID } from "node:crypto"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { createApp } from "../app.js"
import { withDatabase } from "../db/context.js"
import { chatMessages, coachTasks } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
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
      expect(await response.text()).toContain("event: message-start")
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
