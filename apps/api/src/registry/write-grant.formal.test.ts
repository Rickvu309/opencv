import { eq } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import * as databaseContext from "../db/context.js"
import { parseJobId, personActor } from "@workspace/domain"

import {
  getDb,
  insideTransaction,
  transaction,
  withDatabase,
} from "../db/context.js"
import { jobs, user } from "../db/schema.js"
import { writePriority } from "../job/index.js"
import { openBackend, REAL } from "../test/registry-formal-support.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"
import {
  takePriorityGrant,
  withGrantScope,
  type WriteGrant,
} from "./write-grant.js"

const admitted = (entityId: string) => [
  { name: "job.priority", entityId, coachFloor: "confirm" as const },
]

it("a priority permission works only inside the database transaction that took it", async () => {
  const backend = await openBackend()
  const registry = installRegistry()
  const userId = "grant-tx-owner"
  try {
    await withDatabase(backend.db, async () => {
      await getDb().insert(user).values({
        id: userId,
        name: "Ada",
        email: "grant-tx@example.com",
      })
      const person = personActor(userId)
      const create = async (title: string) =>
        idOf(
          (
            await registry.execute({
              name: "job.create",
              input: { title, company: "Northwind" },
              actor: person,
            })
          ).output
        )
      const read = async (jobId: string) => {
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
      const saved = await create("Saved")
      await withGrantScope({ ownerId: userId, writes: admitted(saved) }, () =>
        transaction(async () => {
          await writePriority(
            takePriorityGrant(saved),
            parseJobId(saved),
            "high"
          )
        })
      )
      expect(await read(saved)).toMatchObject({
        priority: "high",
        priorityRevision: 1,
      })

      const plain = await create("Plain")
      await expect(
        withGrantScope(
          { ownerId: userId, writes: admitted(plain) },
          async () => {
            expect(insideTransaction()).toBe(false)
            await writePriority(
              takePriorityGrant(plain),
              parseJobId(plain),
              "high"
            )
          }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      expect(await read(plain)).toMatchObject({
        priority: "normal",
        priorityRevision: 0,
      })

      const carried: { grant?: WriteGrant } = {}
      await withGrantScope(
        { ownerId: userId, writes: admitted(plain) },
        async () => {
          await transaction(async () => {
            carried.grant = takePriorityGrant(plain)
          })
          const grant = carried.grant
          if (!grant) throw new Error("missing grant")
          await expect(
            transaction(() => writePriority(grant, parseJobId(plain), "high"))
          ).rejects.toMatchObject({ code: "FORBIDDEN" })
        }
      )
      expect(await read(plain)).toMatchObject({
        priority: "normal",
        priorityRevision: 0,
      })

      const rolled: { grant?: WriteGrant } = {}
      await withGrantScope(
        { ownerId: userId, writes: admitted(plain) },
        async () => {
          await expect(
            transaction(async () => {
              rolled.grant = takePriorityGrant(plain)
              await writePriority(rolled.grant, parseJobId(plain), "high")
              throw new Error("undo")
            })
          ).rejects.toThrow(/undo/)
          expect(await read(plain)).toMatchObject({
            priority: "normal",
            priorityRevision: 0,
          })
          const grant = rolled.grant
          if (!grant) throw new Error("missing grant")
          await expect(
            transaction(() => writePriority(grant, parseJobId(plain), "high"))
          ).rejects.toMatchObject({ code: "FORBIDDEN" })
        }
      )
      expect(await read(plain)).toMatchObject({
        priority: "normal",
        priorityRevision: 0,
      })
    })
  } finally {
    await backend.close()
  }
}, 120_000)

function latch() {
  let release: () => void = () => {
    throw new Error("Latch was not initialized")
  }
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  return { ready, release }
}

it.each([
  "commit",
  "inflight",
  "rollback",
  "savepoint-release",
  "savepoint-rollback",
  ...(REAL ? ["retained-mutant"] : []),
])(
  "a detached continuation refuses a closed transaction: %s",
  async (completion) => {
    const backend = await openBackend()
    const registry = installRegistry()
    const userId = "detached-owner"
    try {
      await withDatabase(backend.db, async () => {
        await getDb().insert(user).values({
          id: userId,
          name: "Ada",
          email: "detached@example.com",
        })
        const jobId = idOf(
          (
            await registry.execute({
              name: "job.create",
              input: { title: "Detached", company: "Northwind" },
              actor: personActor(userId),
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
        const before = await read()
        await withGrantScope(
          { ownerId: userId, writes: admitted(jobId) },
          async () => {
            const gate = latch()
            const late: {
              result?: Promise<{
                inside: boolean
                error: unknown
                accessError: unknown
              }>
            } = {}
            const run = async () => {
              const grant = takePriorityGrant(jobId)
              const client = getDb()
              const pendingWrite =
                completion === "inflight"
                  ? writePriority(grant, parseJobId(jobId), "high").then(
                      () => undefined,
                      (error: unknown) => error
                    )
                  : undefined
              late.result = (async () => {
                await gate.ready
                const bypass = completion === "retained-mutant"
                const access = bypass
                  ? vi.spyOn(databaseContext, "getDb").mockReturnValue(client)
                  : undefined
                const membership = bypass
                  ? vi
                      .spyOn(databaseContext, "insideTransaction")
                      .mockReturnValue(true)
                  : undefined
                try {
                  const inside = insideTransaction()
                  let accessError: unknown
                  try {
                    getDb()
                  } catch (error) {
                    accessError = error
                  }
                  const error = pendingWrite
                    ? await pendingWrite
                    : await writePriority(
                        grant,
                        parseJobId(jobId),
                        "high"
                      ).then(
                        () => undefined,
                        (error: unknown) => error
                      )
                  return { inside, error, accessError }
                } finally {
                  access?.mockRestore()
                  membership?.mockRestore()
                }
              })()
              if (completion.endsWith("rollback"))
                throw new Error("rollback detached")
            }
            const finish = async () => {
              if (completion.startsWith("savepoint")) {
                const { savepoint } = databaseContext
                await savepoint(run)
              } else {
                await transaction(run)
              }
            }
            const check = async () => {
              if (completion.endsWith("rollback"))
                await expect(finish()).rejects.toThrow("rollback detached")
              else await finish()
              gate.release()
              if (!late.result) throw new Error("missing continuation")
              const result = await late.result
              const after = await read()
              const { normalizeWrite, traceProblems } = await import(
                new URL(
                  "../../../../scripts/lib/write-grant.mjs",
                  import.meta.url
                ).href
              )
              const problems = traceProblems(
                result.error
                  ? []
                  : [
                      normalizeWrite({
                        asserted: true,
                        transactionOpen: false,
                        revisionDelta:
                          after.priorityRevision - before.priorityRevision,
                      }),
                    ]
              )
              if (completion === "retained-mutant") {
                expect(result.error).toBeUndefined()
                expect(after).toMatchObject({
                  priority: "high",
                  priorityRevision: 1,
                })
                expect(problems).toContainEqual({ kind: "closed-transaction" })
              } else {
                expect(result.inside).toBe(false)
                expect(result.error).toMatchObject({ code: "FORBIDDEN" })
                expect(result.accessError).toMatchObject({ code: "FORBIDDEN" })
                expect(after).toEqual(before)
                expect(problems).toEqual([])
              }
            }
            if (completion.startsWith("savepoint")) await transaction(check)
            else await check()
          }
        )
      })
    } finally {
      await backend.close()
    }
  },
  120_000
)
