import {
  defineOperation,
  delegateActorSchema,
  type Actor,
  type ActivityDraft,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createId } from "../platform/id.js"
import { createAuth } from "../auth.js"
import { signedInGate } from "../middleware.js"
import * as databaseContext from "../db/context.js"
import { type AppDatabase, getDb, withDatabase } from "../db/context.js"
import {
  activity,
  idempotency,
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
import { createCommandRoutes } from "./http.js"
import { installRegistry } from "../install.js"
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
  name: "job.update",
  version: 1,
  kind: "command",
  description: "Change fixture",
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
  description: "Read fixture",
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
    async (input: z.output<typeof write.input>, actor: Actor) => {
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
    ) => ({
      command: write.name,
      input: { value: output.previousPriority },
      expect: {
        query: read.name,
        input: {},
        matches: { value: output.value },
        skipped: "The fixture has changed",
      },
    }),
    activity: (
      _input: z.output<typeof write.input>,
      _output: z.output<typeof privateResult>,
      actor: Actor
    ) => ({
      subjectKind: "account" as const,
      subjectId: actor.userId,
      summary: "Fixture",
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

function addLegacy(
  registry: Registry,
  execute: (
    input: z.output<typeof write.input>,
    actor: Actor
  ) => Promise<unknown>,
  activity: () => ActivityDraft | null = () => null
) {
  registry.addCommand(
    {
      name: "job.rename",
      description: "Legacy fixture",
      input: write.input,
      coach: "auto",
      destructive: false,
      step: () => "Legacy fixture",
      reversal: () => null,
      activity,
    },
    execute
  )
}

async function withFixture(
  run: (
    db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  ) => Promise<void>
) {
  const { db, client } = await createMigratedTestDb()
  try {
    await withDatabase(db, () => run(db))
  } finally {
    vi.restoreAllMocks()
    await client.close()
  }
}

function expectPublic(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /previousPriority|server-only|secret/
  )
}

describe("catalog kernel", () => {
  it.each(["activity", "idempotency"] as const)(
    "checks %s replay identity on both lookups",
    async (store) =>
      withFixture(async (db) => {
        await db.insert(user).values({
          id: "replay-owner",
          name: "Before",
          email: "replay@test.local",
        })

        for (const conflictWinner of [false, true]) {
          for (const mismatch of [
            "input",
            "command",
            "hash",
            "legacy-command",
            "legacy-same",
          ] as const) {
            const setup = fixture()
            const registry =
              store === "activity" ? setup.registry : new Registry()
            if (store === "idempotency")
              bindOperation(registry, {
                ...setup.binding,
                activity: { silent: "Replay lookup stores no receipt" },
                reversal: { irreversible: "Replay lookup stores no Undo" },
              })
            const legacy = "job.rename"
            addLegacy(registry, setup.execute, () =>
              store === "activity"
                ? {
                    subjectKind: "account",
                    subjectId: "replay-owner",
                    summary: "Legacy fixture",
                  }
                : null
            )
            const key = `${store}-${conflictWinner}-${mismatch}`
            const actor = personActor("replay-owner")
            const original = { value: "First" }
            const output = {
              id: actor.userId,
              value: "First",
              nested: { label: "public", secret: "server-only" },
            }
            const seed = async () => {
              const identity = {
                userId: actor.userId,
                command: write.name,
                inputHash: mismatch.startsWith("legacy-")
                  ? null
                  : inputHash(
                      mismatch === "hash" ? { value: "Other" } : original
                    ),
                result: output,
              }
              if (store === "activity")
                await getDb()
                  .insert(activity)
                  .values({
                    ...identity,
                    id: createId(),
                    actor: "person",
                    subjectKind: "account",
                    subjectId: actor.userId,
                    summary: "Fixture",
                    idempotencyKey: key,
                  })
              else
                await getDb()
                  .insert(idempotency)
                  .values({ ...identity, key })
            }
            if (conflictWinner) {
              const savepoint = databaseContext.savepoint
              vi.spyOn(databaseContext, "savepoint").mockImplementationOnce(
                async (effect) => {
                  await seed()
                  return savepoint(effect)
                }
              )
            } else await seed()
            const request = {
              name:
                mismatch === "command" || mismatch === "legacy-command"
                  ? legacy
                  : write.name,
              input: mismatch === "input" ? { value: "Other" } : original,
              actor,
              idempotencyKey: key,
            }
            if (mismatch === "legacy-same") {
              const replayed = await registry.execute(request)
              expect(replayed.output).toEqual({
                id: actor.userId,
                value: "First",
                nested: { label: "public" },
              })
              expectPublic(replayed)
              expect(replayed.touches).toEqual([
                { ownerId: actor.userId, name: "workspace" },
              ])
              await expect(
                registry.execute({ ...request, input: { value: "Other" } })
              ).resolves.toEqual(replayed)
              expect(setup.execute).toHaveBeenCalledTimes(
                conflictWinner ? 1 : 0
              )
            } else
              await expect(registry.execute(request)).rejects.toMatchObject({
                code: "CONFLICT",
              })
            vi.restoreAllMocks()
            const [owner] = await db
              .select()
              .from(user)
              .where(eq(user.id, actor.userId))
            expect(owner?.name).toBe("Before")
          }
        }
        const { registry } = fixture()
        addLegacy(registry, async () => ({
          internalSecret: "legacy-private",
        }))
        const request = {
          name: "job.rename",
          input: { value: "First" },
          actor: personActor("replay-owner"),
          idempotencyKey: "legacy-original",
        }
        await registry.execute(request)
        await expect(
          registry.execute({ ...request, input: { value: "Other" } })
        ).rejects.toMatchObject({ code: "CONFLICT" })
        await expect(
          registry.execute({ ...request, name: write.name })
        ).rejects.toMatchObject({ code: "CONFLICT" })
      })
  )

  it("guards Undo against later writes", async () =>
    withFixture(async (db) => {
      await db
        .insert(user)
        .values({ id: "undo-owner", name: "Before", email: "undo@test.local" })

      const { registry, binding } = fixture()
      const actor = personActor("undo-owner")
      const first = await registry.execute({
        name: write.name,
        input: { value: "First" },
        actor,
      })
      await registry.execute({
        name: write.name,
        input: { value: "Latest" },
        actor,
      })
      await expect(
        registry.undo(actor.userId, first.activityId!)
      ).rejects.toThrow("The fixture has changed")
      const unguarded = new Registry()
      bindOperation(unguarded, {
        ...binding,
        reversal: () =>
          JSON.parse(
            JSON.stringify({
              command: write.name,
              input: { value: "Before" },
            })
          ),
      })
      await expect(
        unguarded.execute({
          name: write.name,
          input: { value: "Overwritten" },
          actor,
        })
      ).rejects.toThrow("Reversals require a guarded expectation")
      const [owner] = await db
        .select()
        .from(user)
        .where(eq(user.id, actor.userId))
      expect(owner?.name).toBe("Latest")
    }))

  it("projects HTTP receipts and rejects key mismatches", async () =>
    withFixture(async (db) => {
      const app = createTestApp(db)
      const auth = createAuth({
        db,
        sessionSecret: testSessionSecret,
        authUrl: testAuthUrl,
        webOrigins: [testWebOrigin],
        rateLimitEnabled: false,
      })
      const { registry, execute, binding } = fixture()
      const signedIn = signedInGate(auth, db as unknown as AppDatabase)
      app.route(
        "/fixture/commands",
        createCommandRoutes({ signedIn, registry })
      )
      app.route("/fixture/reads", createReadRoutes({ signedIn, registry }))
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
        "/fixture/commands/job.update",
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
          await app.request("/fixture/commands/job.update", request)
        ).json()
      )
      expect(execute).toHaveBeenCalledTimes(1)
      addLegacy(registry, execute)
      for (const [name, input] of [
        [write.name, { value: "Different" }],
        ["job.rename", { value: "After" }],
      ] as const) {
        const mismatch = await app.request(`/fixture/commands/${name}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ input, idempotencyKey: "fixture-key" }),
        })
        expect(mismatch.status).toBe(409)
        const body = await mismatch.json()
        expect(body).toMatchObject({ ok: false, error: { code: "CONFLICT" } })
        expectPublic(body)
      }
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
      for (const [name, options, status] of [
        ["job.list", { body: "{}" }, 401],
        ["job.list", { headers, body: "broken" }, 400],
        ["profile.get", { headers, body: "{}" }, 404],
      ] as const) {
        const response = await app.request(`/fixture/reads/${name}`, {
          method: "POST",
          ...options,
        })
        expect(response.status).toBe(status)
      }
      const [receipt] = await db
        .select()
        .from(activity)
        .where(eq(activity.command, write.name))
      expect(receipt?.result).toMatchObject({
        previousPriority: "Before",
        nested: { secret: "server-only" },
      })
      expect(receipt?.reversalInput).toEqual({ value: "Before" })

      expectPublic(await registry.undo(ownerId, receipt!.id))
      expect(
        await registry.read(read.name, {}, personActor(ownerId))
      ).toMatchObject({ value: "Before" })
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
    }))

  it("projects fake Coach receipts and MCP tools", async () =>
    withFixture(async (db) => {
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
            { id: "fixture", name: "job.update", input: { value: "Coach" } },
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
    }))
})
