import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { parseJobId, personActor } from "@workspace/domain"

import {
  getDb,
  insideTransaction,
  transaction,
  withDatabase,
} from "../db/context.js"
import { jobs, user } from "../db/schema.js"
import { writePriority } from "../job/index.js"
import { openBackend } from "../test/registry-formal-support.js"
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
