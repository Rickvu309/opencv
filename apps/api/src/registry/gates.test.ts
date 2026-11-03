import { personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase } from "../db/context.js"
import { activity, pendingActions, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { CommandError } from "./errors.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"
import { Registry } from "./registry.js"
import { seedCoachActor } from "../test/coach-turn.js"

async function seed(
  userId: string,
  db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
) {
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` })
}

async function refusal(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  )
  expect(error).toBeInstanceOf(CommandError)
  return error as CommandError
}

describe("execute refuses a gated command the Coach was not offered", () => {
  it("refuses a gated command the Coach was never offered", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    await seed("gate-checklist", db)
    await withDatabase(db, async () => {
      const person = personActor("gate-checklist")
      const chat = await registry.execute({
        name: "chat.create",
        input: {},
        actor: person,
      })
      const coach = await seedCoachActor("gate-checklist", idOf(chat.output))
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Intern", company: "Northwind" },
        actor: person,
      })
      const jobId = idOf(job.output)
      const add = { jobId, label: "Prepare stories" }

      const allowed = await registry.execute({
        name: "job.addChecklistItem",
        input: add,
        actor: coach,
      })
      expect(allowed.output).toMatchObject({ label: "Prepare stories" })

      await db
        .update(user)
        .set({ agentInterview: false })
        .where(eq(user.id, "gate-checklist"))
      expect((await registry.tools(coach)).map((e) => e.name)).not.toContain(
        "job.addChecklistItem"
      )
      const error = await refusal(
        registry.execute({
          name: "job.addChecklistItem",
          input: add,
          actor: coach,
        })
      )
      expect(error.code).toBe("COACH_NOT_ALLOWED")
      expect(error.message).toMatch(/Settings/)

      const byPerson = await registry.execute({
        name: "job.addChecklistItem",
        input: add,
        actor: person,
      })
      expect(byPerson.output).toMatchObject({ label: "Prepare stories" })
    })
    await client.close()
  })

  it("refuses to approve a pending action after the toggle is turned off", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = new Registry()
    let ran = 0
    registry.addCommand(
      {
        name: "inbox.archiveAll",
        description: "Archive everything.",
        input: z.object({}).strict(),
        coach: "confirm",
        destructive: false,
        reversal: () => null,
        step: () => "Archive everything",
        activity: () => ({
          subjectKind: "inbox",
          subjectId: "all",
          summary: "Archived",
        }),
      },
      async () => {
        ran += 1
        return {}
      }
    )
    await seed("gate-approve", db)
    await withDatabase(db, async () => {
      const chat = await installRegistry().execute({
        name: "chat.create",
        input: {},
        actor: personActor("gate-approve"),
      })
      const coach = await seedCoachActor("gate-approve", idOf(chat.output))
      const pending = await registry.execute({
        name: "inbox.archiveAll",
        input: {},
        actor: coach,
      })
      const pendingId = pending.pendingActionId
      if (!pendingId) throw new Error("expected a pending action")

      await db
        .update(user)
        .set({ agentEmail: false })
        .where(eq(user.id, "gate-approve"))
      const error = await refusal(registry.approve("gate-approve", pendingId))
      expect(error.code).toBe("COACH_NOT_ALLOWED")
      expect(ran).toBe(0)
      expect(
        await db
          .select()
          .from(activity)
          .where(eq(activity.userId, "gate-approve"))
      ).toEqual([])
      const [row] = await db
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.id, pendingId))
      expect(row?.status).toBe("pending")

      await db
        .update(user)
        .set({ agentEmail: true })
        .where(eq(user.id, "gate-approve"))
      const approved = await registry.approve("gate-approve", pendingId)
      expect(approved?.command).toBe("inbox.archiveAll")
      expect(ran).toBe(1)
    })
    await client.close()
  })
})

describe("undo", () => {
  it("refuses a row with no reversal and leaves undoneAt unset", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    await seed("undo-gates", db)
    await withDatabase(db, async () => {
      const person = personActor("undo-gates")
      const job = await registry.execute({
        name: "job.create",
        input: { title: "Intern", company: "Northwind" },
        actor: person,
      })
      const jobId = idOf(job.output)
      const note = await registry.execute({
        name: "job.addNote",
        input: { jobId, body: "Called the recruiter" },
        actor: person,
      })
      if (!note.activityId) throw new Error("expected an activity row")
      const error = await refusal(registry.undo("undo-gates", note.activityId))
      expect(error.code).toBe("CONFLICT")
      const [row] = await db
        .select()
        .from(activity)
        .where(eq(activity.id, note.activityId))
      expect(row?.undoneAt).toBeNull()

      const moved = await registry.execute({
        name: "job.move",
        input: { jobId, stage: "applied" },
        actor: person,
      })
      if (!moved.activityId) throw new Error("expected an activity row")
      const undone = await registry.undo("undo-gates", moved.activityId)
      expect(undone.undoneAt).toBeInstanceOf(Date)
      const after = (await registry.read("job.get", { jobId }, person)) as {
        stage: string
      }
      expect(after.stage).toBe("saved")
    })
    await client.close()
  })
})
