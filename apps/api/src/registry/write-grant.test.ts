import { readFileSync } from "node:fs"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import {
  delegateActorSchema,
  parseJobId,
  personActor,
  type JobId,
} from "@workspace/domain"

import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  agentConnections,
  jobs,
  oauthClient,
  pendingActions,
  user,
} from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { writePriority } from "../job/index.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"
import {
  assertPriorityGrant,
  takePriorityGrant,
  withGrantScope,
  type WriteGrant,
} from "./write-grant.js"
// @ts-expect-error detectors are plain scripts with no declaration file
import {
  detect,
  normalizeWrite,
  traceProblems,
} from "../../../../scripts/lib/write-grant.mjs"
// @ts-expect-error detectors are plain scripts with no declaration file
import {
  basisProblems,
  detect as detectBasis,
  normalizeApproval,
} from "../../../../scripts/lib/proposal-basis.mjs"

declare const sampleJob: JobId
declare function createProposal(options: {
  command: string
  input: unknown
  summary: string
}): unknown
declare function execute(options: {
  name: string
  input: unknown
  skipConfirm?: boolean
  expectedRevision?: number | null
}): unknown

async function actorOnlyPriority(
  actor: { userId: string },
  jobId: string,
  priority: "low" | "normal" | "high"
) {
  await getDb()
    .update(jobs)
    .set({ priority, updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
  return actor.userId
}

async function priorityWithoutRevision(
  grant: WriteGrant,
  jobId: string,
  priority: "low" | "normal" | "high"
) {
  await getDb()
    .update(jobs)
    .set({ priority, updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
  return grant.entityId
}

function proposeWithoutBasis(input: unknown) {
  return createProposal({
    command: "job.setPriority",
    input,
    summary: "Set priority",
  })
}

function approve(row: { input: unknown }) {
  return execute({
    name: "job.setPriority",
    input: row.input,
    skipConfirm: true,
  })
}

function approveNull(row: { input: unknown }) {
  return execute({
    name: "job.setPriority",
    input: row.input,
    skipConfirm: true,
    expectedRevision: null,
  })
}

const admitted = (entityId: string) => [
  { name: "job.priority", entityId, coachFloor: "confirm" as const },
]

function kinds(problems: { kind: string }[]) {
  return problems.map((problem) => problem.kind)
}

describe("priority writes require a one-time permission and a matching version", () => {
  it("flags an actor-only writer, a missing version bump, a missing permission check, and a null version", () => {
    const source = readFileSync(
      new URL("./write-grant.test.ts", import.meta.url),
      "utf8"
    )
    const store = readFileSync(
      new URL("../job/store.ts", import.meta.url),
      "utf8"
    )
    const registry = readFileSync(
      new URL("./registry.ts", import.meta.url),
      "utf8"
    )
    expect(kinds(detect(source, "write-grant.test.ts"))).toEqual(
      expect.arrayContaining(["actor-only", "missing-bump", "missing-assert"])
    )
    expect(detect(store, "store.ts")).toEqual([])
    expect(kinds(detectBasis(source, "write-grant.test.ts"))).toEqual(
      expect.arrayContaining([
        "missing-basis",
        "unchecked-approval",
        "null-basis",
      ])
    )
    expect(detectBasis(registry, "registry.ts")).toEqual([])
    expect(
      traceProblems([
        {
          call: "writePriority",
          grant: "open",
          owner: "same",
          entity: "same",
          resource: "job.priority",
          transaction: "same",
          bumped: true,
        },
      ])
    ).toEqual([])
    expect(
      kinds(
        traceProblems([
          {
            call: "writePriority",
            grant: "actor",
            owner: "other",
            entity: "other",
            resource: "job",
            transaction: "other",
            bumped: false,
          },
        ])
      )
    ).toEqual(
      expect.arrayContaining([
        "grant",
        "owner",
        "entity",
        "resource",
        "transaction",
        "missing-bump",
      ])
    )
    expect(actorOnlyPriority).toBeTypeOf("function")
    expect(priorityWithoutRevision).toBeTypeOf("function")
    expect(proposeWithoutBasis).toBeTypeOf("function")
    expect(approve).toBeTypeOf("function")
    expect(approveNull).toBeTypeOf("function")
    const refuseActor = () => {
      // @ts-expect-error an actor is not a priority permission
      return writePriority(personActor("owner"), sampleJob, "high")
    }
    expect(refuseActor).toBeTypeOf("function")
  })

  it("bumps on a real change and on undo, and rolls back a stale change", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "grant-owner"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "grant@example.com",
    })
    const person = personActor(userId)
    try {
      await withDatabase(db, async () => {
        const jobId = idOf(
          (
            await registry.execute({
              name: "job.create",
              input: { title: "Intern", company: "Northwind" },
              actor: person,
            })
          ).output
        )
        const read = async () => {
          const [row] = await getDb()
            .select({
              priority: jobs.priority,
              priorityRevision: jobs.priorityRevision,
              location: jobs.location,
            })
            .from(jobs)
            .where(eq(jobs.id, jobId))
          return row
        }
        expect(await read()).toMatchObject({
          priority: "normal",
          priorityRevision: 0,
        })
        await expect(
          registry.execute({
            name: "job.update",
            input: {
              jobId,
              patch: { location: "Hanoi", priority: "high" },
            },
            actor: person,
            expectedRevision: 4,
          })
        ).rejects.toMatchObject({ code: "CONFLICT" })
        expect(await read()).toMatchObject({
          priority: "normal",
          priorityRevision: 0,
          location: null,
        })
        const changed = await registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: "high" },
          actor: person,
          idempotencyKey: "grant-once",
        })
        await registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: "high" },
          actor: person,
          idempotencyKey: "grant-once",
        })
        expect(await read()).toMatchObject({
          priority: "high",
          priorityRevision: 1,
        })
        await registry.undo(userId, changed.activityId!)
        expect(await read()).toMatchObject({
          priority: "normal",
          priorityRevision: 2,
        })
        const edited = await registry.execute({
          name: "job.update",
          input: { jobId, patch: { location: "Hanoi", priority: "low" } },
          actor: person,
        })
        expect(await read()).toMatchObject({
          priority: "low",
          priorityRevision: 3,
          location: "Hanoi",
        })
        await registry.undo(userId, edited.activityId!)
        expect(await read()).toMatchObject({
          priority: "normal",
          priorityRevision: 4,
          location: null,
        })
        const otherId = idOf(
          (
            await registry.execute({
              name: "job.create",
              input: { title: "Other", company: "Other" },
              actor: person,
            })
          ).output
        )
        await expect(
          withGrantScope({ ownerId: userId, writes: admitted(jobId) }, () =>
            transaction(async () => {
              const grant = takePriorityGrant(jobId)
              expect(() => takePriorityGrant(jobId)).toThrow(/permission/)
              await expect(
                writePriority(grant, parseJobId(otherId), "high")
              ).rejects.toMatchObject({ code: "FORBIDDEN" })
              return grant
            })
          ).then((grant) => writePriority(grant, parseJobId(jobId), "low"))
        ).rejects.toMatchObject({ code: "FORBIDDEN" })
        const forged = {
          ownerId: userId,
          resource: "job.priority" as const,
          entityId: jobId,
          transactionId: "forged",
          expectedRevision: null,
        } as unknown as WriteGrant
        await expect(
          withGrantScope({ ownerId: userId, writes: admitted(jobId) }, () =>
            writePriority(forged, parseJobId(jobId), "high")
          )
        ).rejects.toMatchObject({ code: "FORBIDDEN" })
        expect(await read()).toMatchObject({
          priority: "normal",
          priorityRevision: 4,
        })
      })
    } finally {
      await client.close()
    }
  })

  it("stores the version on each proposal and refuses the one that is no longer current", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "basis-owner"
    await db.insert(user).values([
      { id: userId, name: "Ada", email: "basis@example.com" },
      { id: "basis-other", name: "Bo", email: "basis-other@example.com" },
    ])
    await db.insert(oauthClient).values({
      id: "basis-client",
      clientId: "basis-client",
      redirectUris: ["http://localhost/callback"],
    })
    await db.insert(agentConnections).values({
      id: "33333333-3333-4333-8333-333333333333",
      userId,
      clientId: "basis-client",
      authorizationCodeId: "basis-authorization",
      name: "My agent",
      audience: "http://localhost/mcp",
      scopes: ["job.read", "job.write"],
      resources: { kind: "jobs" },
      policy: { reads: "allow", writes: "approval" },
      expiresAt: new Date(Date.now() + 60_000),
    })
    const person = personActor(userId)
    const delegate = delegateActorSchema.parse({
      type: "delegate",
      userId,
      connectionId: "33333333-3333-4333-8333-333333333333",
      name: "My agent",
      scopes: ["job.read", "job.write"],
      resources: "jobs",
      reads: "allow",
      writes: "approval",
    })
    try {
      await withDatabase(db, async () => {
        const chatId = idOf(
          (
            await registry.execute({
              name: "chat.create",
              input: {},
              actor: person,
            })
          ).output
        )
        const jobId = idOf(
          (
            await registry.execute({
              name: "job.create",
              input: { title: "Intern", company: "Northwind" },
              actor: person,
            })
          ).output
        )
        const coach = await seedCoachActor(userId, chatId)
        const high = await registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: "high" },
          actor: coach,
        })
        const low = await registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: "low" },
          actor: delegate,
        })
        expect(high.pending).toBe(true)
        expect(low.pending).toBe(true)
        const stored = await getDb()
          .select({
            id: pendingActions.id,
            basisRevision: pendingActions.basisRevision,
          })
          .from(pendingActions)
        expect(stored).toEqual(
          expect.arrayContaining([
            { id: high.pendingActionId, basisRevision: 0 },
            { id: low.pendingActionId, basisRevision: 0 },
          ])
        )
        await registry.approve(userId, high.pendingActionId!)
        const [afterHigh] = await getDb()
          .select({
            priority: jobs.priority,
            priorityRevision: jobs.priorityRevision,
          })
          .from(jobs)
          .where(eq(jobs.id, jobId))
        expect(afterHigh).toMatchObject({
          priority: "high",
          priorityRevision: 1,
        })
        await expect(
          registry.approve(userId, low.pendingActionId!)
        ).rejects.toMatchObject({ code: "CONFLICT" })
        const [afterLow] = await getDb()
          .select({
            priority: jobs.priority,
            priorityRevision: jobs.priorityRevision,
          })
          .from(jobs)
          .where(eq(jobs.id, jobId))
        expect(afterLow).toEqual(afterHigh)
        await expect(
          registry.execute({
            name: "job.setPriority",
            input: { jobId, priority: "low" },
            actor: personActor("basis-other"),
          })
        ).rejects.toMatchObject({ code: "NOT_FOUND" })
        const [afterOther] = await getDb()
          .select({
            priority: jobs.priority,
            priorityRevision: jobs.priorityRevision,
          })
          .from(jobs)
          .where(eq(jobs.id, jobId))
        expect(afterOther).toEqual(afterHigh)
      })
    } finally {
      await client.close()
    }
  })

  it("catches a removed permission check and a null version from the save", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "replay-owner"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "replay@example.com",
    })
    const person = personActor(userId)
    try {
      await withDatabase(db, async () => {
        const jobId = idOf(
          (
            await registry.execute({
              name: "job.create",
              input: { title: "Intern", company: "Northwind" },
              actor: person,
            })
          ).output
        )
        const read = async () => {
          const [row] = await getDb()
            .select({
              priority: jobs.priority,
              priorityRevision: jobs.priorityRevision,
            })
            .from(jobs)
            .where(eq(jobs.id, jobId))
          if (!row) throw new Error("missing job")
          return row
        }
        const spent = async (grant: WriteGrant) => {
          try {
            assertPriorityGrant(grant, userId, jobId)
            return false
          } catch (error) {
            return /already used/.test(
              error instanceof Error ? error.message : ""
            )
          }
        }
        await withGrantScope(
          { ownerId: userId, writes: admitted(jobId), expectedRevision: 0 },
          () =>
            transaction(async () => {
              const before = await read()
              const grant = takePriorityGrant(jobId)
              await writePriority(grant, parseJobId(jobId), "high")
              const after = await read()
              expect(
                traceProblems([
                  normalizeWrite({
                    asserted: await spent(grant),
                    revisionDelta:
                      after.priorityRevision - before.priorityRevision,
                    sameTransaction: true,
                  }),
                ])
              ).toEqual([])
              expect(after).toMatchObject({
                priority: "high",
                priorityRevision: 1,
              })
            })
        )
        const current = (await read()).priorityRevision
        await expect(
          withGrantScope(
            { ownerId: userId, writes: admitted(jobId), expectedRevision: 0 },
            () =>
              transaction(async () => {
                await writePriority(
                  takePriorityGrant(jobId),
                  parseJobId(jobId),
                  "low"
                )
              })
          )
        ).rejects.toMatchObject({ code: "CONFLICT" })
        expect(await read()).toMatchObject({ priority: "high" })
        expect(
          basisProblems([
            normalizeApproval({
              captured: 0,
              passed: 0,
              current,
              wrote: (await read()).priority !== "high",
            }),
          ])
        ).toEqual([])
        await withGrantScope(
          { ownerId: userId, writes: admitted(jobId), expectedRevision: null },
          () =>
            transaction(async () => {
              const before = await read()
              const grant = takePriorityGrant(jobId)
              await getDb()
                .update(jobs)
                .set({ priority: "low", updatedAt: new Date() })
                .where(eq(jobs.id, jobId))
              const after = await read()
              expect(after.priority).toBe("low")
              expect(
                traceProblems([
                  normalizeWrite({
                    asserted: await spent(grant),
                    revisionDelta:
                      after.priorityRevision - before.priorityRevision,
                    sameTransaction: true,
                  }),
                ]).length
              ).toBeGreaterThan(0)
            })
        )
        expect(
          basisProblems([
            normalizeApproval({
              captured: 0,
              passed: null,
              current,
              wrote: (await read()).priority === "low",
            }),
          ]).map((problem) => problem.kind)
        ).toContain("null-basis")
      })
    } finally {
      await client.close()
    }
  })
})
