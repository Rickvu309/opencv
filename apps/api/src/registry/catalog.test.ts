import {
  catalog,
  catalogDigest,
  commands,
  defineOperation,
  delegateActorSchema,
  type Operation,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createAuth } from "../auth.js"
import { type AppDatabase, getDb, withDatabase } from "../db/context.js"
import {
  activity,
  agentConnections,
  coachTasks,
  oauthClient,
  taskEvents,
  toolIntents,
  user,
} from "../db/schema.js"
import { createScriptedWorkerRuntime, runCoachWorker } from "../coach/index.js"
import { seedTask } from "../test/coach-task-support.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testAuthUrl,
  testSessionSecret,
  testWebOrigin,
} from "../test/harness.js"
import { bindCatalog, bindOperation } from "./bind.js"
import { implementations } from "./catalog.js"
import { createCommandRoutes } from "./http.js"
import { installRegistry } from "./install.js"
import { createReadRoutes } from "./read.js"
import { inputHash } from "./receipt.js"
import { Registry } from "./registry.js"

const publicResult = z.object({
  id: z.string(),
  value: z.string(),
  nested: z.object({ label: z.string() }),
})
const write = defineOperation({
  owner: "job",
  name: "job.create",
  version: 1,
  kind: "command",
  description: "Change a test fixture",
  input: z
    .object({ value: z.string().min(1), jobId: z.string().optional() })
    .strict(),
  publicResult,
  coach: "auto",
  delegate: "reversibleJob",
  destructive: false,
  idempotency: "keyed",
  writes: () => [{ name: "job.fixture", coachFloor: "auto" }],
})
const read = defineOperation({
  owner: "job",
  name: "job.list",
  version: 1,
  kind: "read",
  description: "Read a test fixture",
  input: z.object({}).strict(),
  publicResult,
  coach: "auto",
  delegate: "jobRead",
  dependsOn: () => [{ name: "job.fixture", coachFloor: "auto" }],
})
const privateResult = publicResult.extend({
  previousPriority: z.string(),
  nested: z.object({ label: z.string(), secret: z.string() }),
})

function fixture(confirm = false) {
  const registry = new Registry()
  const execute = vi.fn(
    async (
      input: z.output<typeof write.input>,
      actor: import("@workspace/domain").Actor
    ) => {
      const [previous] = await getDb()
        .select()
        .from(user)
        .where(eq(user.id, actor.userId))
      if (!previous) throw new Error("Fixture owner missing")
      await getDb()
        .update(user)
        .set({ name: input.value })
        .where(eq(user.id, actor.userId))
      return {
        id: actor.userId,
        value: input.value,
        previousPriority: previous.name,
        nested: { label: "public", secret: "server-only" },
      }
    }
  )
  const binding = {
    operation: {
      ...write,
      coach: confirm ? ("confirm" as const) : ("auto" as const),
    },
    execute,
    privateResult,
    reversal: (
      _input: z.output<typeof write.input>,
      output: z.output<typeof privateResult>
    ) => ({ command: write.name, input: { value: output.previousPriority } }),
    activity: (
      _input: z.output<typeof write.input>,
      _output: z.output<typeof privateResult>,
      actor: import("@workspace/domain").Actor
    ) => ({
      subjectKind: "account" as const,
      subjectId: actor.userId,
      summary: "Changed fixture",
      detail: { secret: "server-only" },
    }),
  }
  bindCatalog(registry, { [write.name]: binding })
  bindOperation(registry, {
    operation: read,
    execute: async (_input, actor) => {
      const [row] = await getDb()
        .select()
        .from(user)
        .where(eq(user.id, actor.userId))
      return {
        id: actor.userId,
        value: row!.name,
        nested: { label: "public", secret: "server-only" },
      }
    },
  })
  return { registry, execute, binding }
}

function expectPublic(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /previousPriority|server-only|secret/
  )
}

describe("catalog adapters use the existing kernel", () => {
  it("installs a disjoint empty production catalog alongside all legacy entries", () => {
    const registry = installRegistry()
    expect(Object.keys(catalog)).toEqual([])
    expect(Object.keys(implementations)).toEqual([])
    expect(catalogDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(installRegistry()).toBe(registry)
    const entries: Record<string, Operation> = catalog
    const expected = [
      ...Object.keys(commands),
      ...Object.values(entries)
        .filter((operation) => operation.kind === "command")
        .map((operation) => operation.name),
    ].sort()
    expect(registry.commandNames().sort()).toEqual(expected)
    expect(new Set(expected).size).toBe(expected.length)
  })

  it("projects HTTP reads, commands, keyed replay and Undo while retaining private receipts", async () => {
    const { db, client } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const auth = createAuth({
        db,
        sessionSecret: testSessionSecret,
        authUrl: testAuthUrl,
        webOrigins: [testWebOrigin],
        rateLimitEnabled: false,
      })
      const { registry, execute, binding } = fixture()
      app.route(
        "/fixture/commands",
        createCommandRoutes({
          auth,
          db: db as unknown as AppDatabase,
          registry,
        })
      )
      app.route(
        "/fixture/reads",
        createReadRoutes({ auth, db: db as unknown as AppDatabase, registry })
      )
      const { cookie } = await signUp(app, {
        name: "Before",
        email: "catalog@test.local",
      })
      const headers = authHeaders(cookie)
      const session = await (
        await app.request("/api/session", { headers })
      ).json()
      const ownerId = z
        .object({ user: z.object({ id: z.string() }) })
        .parse(session).user.id
      const request = {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: { value: "After" },
          idempotencyKey: "fixture-key",
        }),
      }
      const response = await app.request(
        "/fixture/commands/job.create",
        request
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toMatchObject({
        data: { value: "After" },
        meta: { touches: [{ ownerId, name: "job.fixture" }] },
      })
      expectPublic(body)
      expectPublic(
        await (
          await app.request("/fixture/commands/job.create", request)
        ).json()
      )
      expect(execute).toHaveBeenCalledTimes(1)
      const readResponse = await app.request("/fixture/reads/job.list", {
        method: "POST",
        headers,
        body: "{}",
      })
      expect(readResponse.status).toBe(200)
      expect(await readResponse.json()).toEqual({
        ok: true,
        data: { id: ownerId, value: "After", nested: { label: "public" } },
      })
      expect(
        (
          await app.request("/fixture/reads/job.list", {
            method: "POST",
            body: "{}",
          })
        ).status
      ).toBe(401)
      expect(
        (
          await app.request("/fixture/reads/job.list", {
            method: "POST",
            headers,
            body: "broken",
          })
        ).status
      ).toBe(400)
      expect(
        (
          await app.request("/fixture/reads/profile.get", {
            method: "POST",
            headers,
            body: "{}",
          })
        ).status
      ).toBe(404)
      const [receipt] = await db
        .select()
        .from(activity)
        .where(eq(activity.command, write.name))
      expect(receipt?.result).toMatchObject({
        previousPriority: "Before",
        nested: { secret: "server-only" },
      })
      expect(receipt?.reversalInput).toEqual({ value: "Before" })
      await withDatabase(db, async () => {
        expectPublic(await registry.undo(ownerId, receipt!.id))
        expect(
          await registry.read(read.name, {}, personActor(ownerId))
        ).toMatchObject({ value: "Before" })
      })
      const legacy = await app.request("/api/commands/chat.create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: { title: "Legacy" },
          idempotencyKey: "legacy-key",
        }),
      })
      expect(legacy.status).toBe(200)
      expect(await legacy.json()).toMatchObject({
        data: { title: "Legacy" },
        meta: { touches: [{ ownerId, name: "workspace" }] },
      })
      expect(() => bindOperation(registry, binding)).toThrow(
        "Duplicate registry entry"
      )
    } finally {
      await client.close()
    }
  })

  it("publishes only public output to a fake Coach task, its saved receipts and MCP eligibility", async () => {
    const { db, client } = await createMigratedTestDb()
    try {
      await withDatabase(db, async () => {
        const seed = await seedTask(inputHash)
        await db
          .update(coachTasks)
          .set({ contextSnapshot: { messages: [] } })
          .where(eq(coachTasks.id, seed.taskId))
        const { registry, execute } = fixture()
        const runtime = createScriptedWorkerRuntime([
          {
            text: "Changing.",
            intents: [
              { id: "fixture", name: "job.create", input: { value: "Coach" } },
            ],
            inputTokens: 1,
            outputTokens: 1,
          },
          { text: "Saved.", intents: [], inputTokens: 1, outputTokens: 1 },
        ])
        expect(
          await runCoachWorker({
            workerId: "fixture-worker",
            registry,
            runtime: () => runtime,
            catalogDigest: "test",
            runtimeVersion: 1,
            env: {},
          })
        ).toBe(true)
        expect((await db.select().from(coachTasks))[0]?.state).toBe("succeeded")
        const events = await db.select().from(taskEvents)
        expect(events.some((event) => event.kind === "action")).toBe(true)
        expectPublic(events)
        expectPublic(await db.select().from(toolIntents))
        const [receipt] = await db.select().from(activity)
        expect(receipt?.result).toMatchObject({ previousPriority: "Ada" })
        expectPublic(
          await registry.turnReceipts(seed.ownerId, [receipt!.turnId!])
        )
        const connectionId = crypto.randomUUID()
        await db.insert(oauthClient).values({
          id: "catalog-client",
          clientId: "catalog-client",
          redirectUris: ["http://localhost/callback"],
        })
        await db.insert(agentConnections).values({
          id: connectionId,
          userId: seed.ownerId,
          clientId: "catalog-client",
          authorizationCodeId: "catalog-authorization",
          name: "MCP",
          audience: "http://localhost/mcp",
          scopes: ["job.read", "job.write"],
          resources: { kind: "jobs" },
          policy: { reads: "allow", writes: "approval" },
          expiresAt: new Date(Date.now() + 60_000),
        })
        const actor = delegateActorSchema.parse({
          type: "delegate",
          userId: seed.ownerId,
          connectionId,
          name: "MCP",
          scopes: ["job.read", "job.write"],
          resources: "jobs",
          reads: "allow",
          writes: "approval",
        })
        expect((await registry.tools(actor)).map((tool) => tool.name)).toEqual(
          expect.arrayContaining([write.name, read.name])
        )
        expectPublic(await registry.read(read.name, {}, actor))
        const job = await installRegistry().execute({
          name: "job.create",
          input: { title: "Fixture", company: "Test", stage: "applied" },
          actor: personActor(seed.ownerId),
          idempotencyKey: "fixture-job",
        })
        const jobId = z.object({ id: z.string() }).parse(job.output).id
        const proposal = await registry.execute({
          name: write.name,
          input: { value: "Proposal", jobId },
          actor,
          idempotencyKey: "mcp-key",
        })
        expect(proposal.pending).toBe(true)
        expect(proposal.touches).toBeUndefined()
        expect(execute).toHaveBeenCalledTimes(1)
        const approved = await registry.approve(
          seed.ownerId,
          proposal.pendingActionId!
        )
        expect(approved?.result).toMatchObject({ value: "Proposal" })
        expectPublic(approved)
        expect(execute).toHaveBeenCalledTimes(2)
        expectPublic(await registry.undo(seed.ownerId, approved!.id))
        const denied = { ...actor, scopes: [] }
        expect(await registry.tools(denied)).toEqual([])
        await expect(registry.read(read.name, {}, denied)).rejects.toThrow(
          "cannot use this read"
        )
      })
    } finally {
      await client.close()
    }
  })
})
