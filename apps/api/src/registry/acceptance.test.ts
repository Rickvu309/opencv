import { randomUUID } from "node:crypto"

import { ERROR_CODES, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { assertDayCap } from "../account/index.js"
import { withDatabase } from "../db/context.js"
import { coachUsage, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "../install.js"

describe("release-one commands honor company, duplicates, paper versions, plan, delete and the day cap", () => {
  it("checks company, duplicates, paper versions, plan, delete, and the day cap", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-accept"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-accept@example.com",
    })
    const person = personActor(userId)

    await withDatabase(db, async () => {
      await expect(
        registry.execute({
          name: "job.create",
          input: { title: "Intern", company: "  " },
          actor: person,
        })
      ).rejects.toMatchObject({
        code: ERROR_CODES.COMPANY_REQUIRED,
        message: "Add the company name to save this job.",
      })

      const first = await registry.execute({
        name: "job.create",
        input: {
          title: "Intern",
          company: "Northwind",
          jobUrl: "https://jobs.example/n",
        },
        actor: person,
      })
      const jobId = (first.output as { id: string }).id
      await expect(
        registry.execute({
          name: "job.create",
          input: {
            title: "Intern",
            company: "Northwind",
            jobUrl: "https://jobs.example/n",
          },
          actor: person,
        })
      ).rejects.toMatchObject({
        code: ERROR_CODES.DUPLICATE_JOB,
        detail: { jobId },
      })

      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "CV" },
        actor: person,
      })
      const doc = created.output as { id: string; contentVersion: number }
      expect(doc.contentVersion).toBe(1)
      const edited = await registry.execute({
        name: "paper.edit",
        input: {
          docId: doc.id,
          basedOn: 1,
          edits: [
            {
              op: "setHeader",
              fields: { name: "Shipped a small experiment." },
            },
          ],
        },
        actor: person,
      })
      expect((edited.output as { revision: number }).revision).toBe(2)
      const stale = await registry.execute({
        name: "paper.edit",
        input: {
          docId: doc.id,
          basedOn: 1,
          edits: [{ op: "setHeader", fields: { name: "A different edit." } }],
        },
        actor: person,
      })
      expect(stale.output).toMatchObject({
        revision: 2,
        editId: null,
        outcomes: [{ status: "stale" }],
      })

      await expect(
        registry.execute({
          name: "profile.update",
          input: { coachMode: "light" },
          actor: person,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.PLAN_REQUIRED, status: 402 })
      const profile = (await registry.read("profile.get", {}, person)) as {
        coachMode: string
      }
      expect(profile.coachMode).toBe("free")

      await expect(
        registry.execute({
          name: "account.delete",
          input: { confirm: "no" },
          actor: person,
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR })
      const still = await db.select().from(user).where(eq(user.id, userId))
      expect(still).toHaveLength(1)

      await registry.execute({
        name: "account.delete",
        input: { confirm: "DELETE" },
        actor: person,
      })
      const gone = await db.select().from(user).where(eq(user.id, userId))
      expect(gone).toHaveLength(0)
    })

    const cappedId = "user-cap"
    await db.insert(user).values({
      id: cappedId,
      name: "Bea",
      email: "bea-cap@example.com",
    })
    await db.insert(coachUsage).values({
      id: randomUUID(),
      userId: cappedId,
      plan: "free",
      mode: "free",
      provider: "fake",
      model: "fake",
    })
    await withDatabase(db, async () => {
      await expect(
        assertDayCap(cappedId, "free", new Date(), {
          COACH_DAILY_TURN_LIMIT_FREE: "1",
        })
      ).rejects.toMatchObject({
        code: ERROR_CODES.COACH_LIMIT_REACHED,
        status: 429,
        message:
          "You've reached today's Free limit. Resets at 7:00. Pro has unlimited Coach chats.",
        detail: { window: "day", mode: "free", plan: "free" },
      })
    })

    await client.close()
  })
})
