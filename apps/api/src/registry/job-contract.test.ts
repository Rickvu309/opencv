import {
  catalog,
  catalogDigest,
  commands,
  jobContract,
  jobQueries,
  personActor,
  queries,
  type Actor,
  type Operation,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { createScriptedWorkerRuntime, runCoachWorker } from "../coach/index.js"
import { withDatabase } from "../db/context.js"
import { activity, coachTasks, pendingActions, user } from "../db/schema.js"
import { seedTask } from "../test/coach-task-support.js"
import { createMigratedTestDb } from "../test/harness.js"
import { implementations } from "./catalog.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"
import { inputHash } from "./receipt.js"

describe("a job binding that drifts from the job contract is rejected", () => {
  it("parses every job command output and every job query read", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-job-contract"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-job-contract@example.com",
    })
    const person = personActor(userId)

    await withDatabase(db, async () => {
      const seen = new Set<string>()
      const run = async (name: keyof typeof jobContract, input: unknown) => {
        const result = await registry.execute({ name, input, actor: person })
        const parsed = jobContract[name].output.safeParse(result.output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return result.output
      }
      const read = async (name: keyof typeof jobQueries, input: unknown) => {
        const output = await registry.read(name, input, person)
        const parsed = jobQueries[name].output.safeParse(output)
        expect(
          parsed.success,
          `${name}: ${JSON.stringify(parsed.error?.issues)}`
        ).toBe(true)
        seen.add(name)
        return output
      }

      const created = await run("job.create", {
        title: "Intern",
        company: "Northwind",
        jobUrl: "https://example.com/jobs/1",
        deadline: "2030-01-02",
      })
      const jobId = idOf(created)
      const paper = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Contract CV" },
        actor: person,
      })
      const docId = idOf(paper.output)

      await run("job.update", {
        jobId,
        patch: {
          location: "Hanoi",
          interviewAt: "2030-01-01T10:00:00.000Z",
          recruiterEmail: "r@example.com",
          posting: { about: "a", duties: "d", requirements: "r", details: "x" },
        },
      })
      await run("job.move", { jobId, stage: "applied" })
      await run("job.star", { jobId, starred: true })
      await run("job.addNote", { jobId, body: "Called them" })
      const item = await run("job.addChecklistItem", { jobId, label: "Read" })
      const itemId = idOf(item)
      await run("job.setChecklistItem", { jobId, itemId, done: true })
      await run("job.linkPaper", { jobId, docId, kind: "cv" })

      const detail = await read("job.get", { jobId })
      expect(detail).toMatchObject({
        note: "Called them",
        linked: { cv: { name: "Contract CV" }, letter: null },
      })
      await read("job.list", {})
      await read("job.list", { stage: "applied" })
      await read("job.calendar", {
        from: "2029-12-31T00:00:00.000Z",
        to: "2030-01-03T00:00:00.000Z",
      })
      await read("job.preview", { text: "" })
      await read("job.preview", { text: "Acme is hiring an Engineer in Oslo." })
      await read("job.preview", { text: "No structure here" })
      await read("job.preview", {
        url: "https://example.com/jobs/1",
        text: "Acme is hiring an Engineer in Oslo.",
      })

      await run("job.unlinkPaper", { jobId, kind: "cv" })
      await run("job.removeChecklistItem", { jobId, itemId })
      await run("job.delete", { jobId })

      expect([...seen].sort()).toEqual(
        [...Object.keys(jobContract), ...Object.keys(jobQueries)].sort()
      )
    })
    await client.close()
  })

  it("keeps the query table and the registry on the same names", () => {
    const registry = installRegistry()
    expect(
      registry
        .list()
        .queries.map((query) => query.name)
        .sort()
    ).toEqual(Object.keys(queries).sort())
  })

  it("keeps the contract policy and the registry on the same names", () => {
    const registry = installRegistry()
    const registered = new Map(
      registry.list().commands.map((command) => [command.name, command])
    )
    for (const [name, entry] of Object.entries(commands)) {
      expect(registered.get(name), name).toMatchObject({
        coach: entry.coach,
        destructive: entry.destructive,
      })
    }
  })
})

async function withFixture(
  run: (
    db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  ) => Promise<void>
) {
  const { db, client } = await createMigratedTestDb()
  try {
    await withDatabase(db, () => run(db))
  } finally {
    await client.close()
  }
}

function expectPublic(value: unknown) {
  expect(JSON.stringify(value)).not.toContain("previousPriority")
}

describe("Job catalog", () => {
  it("installs both entry types", () => {
    const registry = installRegistry()
    expect(Object.keys(catalog)).toEqual(Object.keys(implementations))
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

  it("proves adopted Job counts, private receipts, replay, guarded Undo and fake Coach approval", async () =>
    withFixture(async (db) => {
      const seed = await seedTask(inputHash)
      const registry = installRegistry()
      const owner = personActor(seed.ownerId)
      const otherId = crypto.randomUUID()
      await db
        .insert(user)
        .values({ id: otherId, name: "Other", email: `${otherId}@test.local` })
      const other = personActor(otherId)
      const create = async (actor: Actor) => {
        const result = await registry.execute({
          name: "job.create",
          input: { title: "Job proof", company: "Acme" },
          actor,
        })
        expect(result.touches).toEqual([
          { ownerId: actor.userId, name: "workspace" },
        ])
        return z.object({ id: z.string() }).parse(result.output).id
      }
      const jobId = await create(owner)
      await create(other)
      const counts = (actor: Actor = owner) =>
        registry.read("job.priorityCounts", {}, actor)
      const before = await counts()
      const otherBefore = await counts(other)
      expect(before).toContainEqual({ priority: "normal", count: 1 })
      const request = {
        name: "job.setPriority",
        input: { jobId, priority: "high" },
        actor: owner,
        idempotencyKey: "job-proof-key",
      }
      const changed = await registry.execute(request)
      expectPublic(changed)
      expect(changed.output).toMatchObject({ id: jobId, priority: "high" })
      expect(changed.touches).toContainEqual({
        ownerId: seed.ownerId,
        name: "job",
        entityId: jobId,
      })
      expect(await counts()).toContainEqual({ priority: "high", count: 1 })
      expect(await counts()).toContainEqual({ priority: "normal", count: 0 })
      expect(await counts(other)).toEqual(otherBefore)
      const replayed = await registry.execute(request)
      expect(replayed.activityId).toBe(changed.activityId)
      const receipts = (await db.select().from(activity)).filter(
        (row) => row.command === "job.setPriority"
      )
      expect(receipts).toHaveLength(1)
      expect(receipts[0]?.result).toMatchObject({ previousPriority: "normal" })
      expectPublic(await registry.undo(seed.ownerId, changed.activityId!))
      expect(await counts()).toEqual(before)
      await db
        .update(coachTasks)
        .set({ contextSnapshot: { messages: [] } })
        .where(eq(coachTasks.id, seed.taskId))
      const runtime = createScriptedWorkerRuntime([
        {
          text: "Proposing priority.",
          intents: [
            {
              id: "priority-proof",
              name: "job.setPriority",
              input: { jobId, priority: "high" },
            },
          ],
          inputTokens: 1,
          outputTokens: 1,
        },
      ])
      expect(
        await runCoachWorker({
          workerId: "job-proof-worker",
          registry,
          runtime: () => runtime,
          catalogDigest: "test",
          runtimeVersion: 1,
          env: {},
        })
      ).toBe(true)
      expect((await db.select().from(coachTasks))[0]?.state).toBe(
        "waitingApproval"
      )
      const [proposal] = await db.select().from(pendingActions)
      expect(proposal?.command).toBe("job.setPriority")
      expect(await counts()).toEqual(before)
      const approved = await registry.approve(seed.ownerId, proposal!.id)
      expectPublic(approved)
      expect(approved?.result).toMatchObject({ priority: "high" })
      expect(await counts()).toContainEqual({ priority: "high", count: 1 })
      expect(await counts(other)).toEqual(otherBefore)
      await registry.execute({
        name: "job.setPriority",
        input: { jobId, priority: "low" },
        actor: owner,
        idempotencyKey: "later-priority",
      })
      await expect(registry.undo(seed.ownerId, approved!.id)).rejects.toThrow(
        "This priority changed again"
      )
      expect(await counts()).toContainEqual({ priority: "low", count: 1 })
    }))
})
