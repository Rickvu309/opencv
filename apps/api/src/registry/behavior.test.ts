import { defineCommand, personActor } from "@workspace/domain"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "./install.js"
import { seedCoachActor } from "../test/coach-turn.js"

const coachToolNames = [
  "chat.delete",
  "chat.get",
  "chat.list",
  "chat.rename",
  "chat.setFocus",
  "coach.usage",
  "file.get",
  "inbox.draftReply",
  "inbox.markDone",
  "inbox.scan",
  "inbox.snooze",
  "job.addChecklistItem",
  "job.addNote",
  "job.calendar",
  "job.create",
  "job.delete",
  "job.get",
  "job.linkPaper",
  "job.list",
  "job.move",
  "job.preview",
  "job.removeChecklistItem",
  "job.setChecklistItem",
  "job.star",
  "job.unlinkPaper",
  "job.update",
  "link.get",
  "notify.request",
  "paper.attachPhoto",
  "paper.create",
  "paper.delete",
  "paper.duplicate",
  "paper.edit",
  "paper.get",
  "paper.import",
  "paper.keywordGap",
  "paper.list",
  "paper.outline",
  "paper.pageCount",
  "paper.rename",
  "paper.setTemplate",
  "profile.get",
  "workspace.search",
]

describe("the registry refuses what the Coach may not run alone, and approves, denies and undoes once", () => {
  it("refuses a destructive command the Coach could run on its own", () => {
    expect(() =>
      defineCommand({
        name: "account.delete",
        description: "Delete",
        input: z.object({}).strict(),
        coach: "auto",
        destructive: true,
        reversal: () => null,
        step: () => "Delete",
        activity: () => null,
      })
    ).toThrow(/destructive/)
  })

  it("confirms, approves once, denies, and undoes once", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-behavior"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-behavior@example.com",
    })
    const person = personActor(userId)
    await withDatabase(db, async () => {
      const chat = await registry.execute({
        name: "chat.create",
        input: {},
        actor: person,
      })
      const chatId = (chat.output as { id: string }).id
      const created = await registry.execute({
        name: "job.create",
        input: { title: "Intern", company: "Northwind" },
        actor: person,
      })
      const jobId = (created.output as { id: string }).id
      const coach = await seedCoachActor(userId, chatId)
      const pending = await registry.execute({
        name: "job.move",
        input: { jobId, stage: "applied" },
        actor: coach,
      })
      expect(pending.pending).toBe(true)
      expect(pending.activityId).toBeNull()
      const before = (await registry.read("job.get", { jobId }, person)) as {
        stage: string
      }
      expect(before.stage).toBe("saved")
      const pendingId = pending.pendingActionId
      if (!pendingId) throw new Error("missing pending action")
      const approved = await registry.approve(userId, pendingId)
      if (!approved) throw new Error("approve returned no activity")
      expect(approved.actor).toBe("coach")
      expect(approved.command).toBe("job.move")
      const again = await registry.approve(userId, pendingId)
      if (!again) throw new Error("approve returned no activity")
      expect(again.id).toBe(approved.id)
      const moved = (await registry.read("job.get", { jobId }, person)) as {
        stage: string
      }
      expect(moved.stage).toBe("applied")
      await registry.undo(userId, approved.id)
      const restored = (await registry.read("job.get", { jobId }, person)) as {
        stage: string
      }
      expect(restored.stage).toBe("saved")
      await expect(registry.undo(userId, approved.id)).rejects.toThrow(
        /already undone/
      )

      const second = await registry.execute({
        name: "job.move",
        input: { jobId, stage: "interview" },
        actor: coach,
      })
      const secondId = second.pendingActionId
      if (!secondId) throw new Error("missing pending action")
      const denied = await registry.deny(userId, secondId)
      expect(denied.status).toBe("denied")
      const repeat = await registry.deny(userId, secondId)
      expect(repeat.status).toBe("denied")
      await expect(registry.approve(userId, secondId)).rejects.toThrow(
        /declined/
      )
      const stayed = (await registry.read("job.get", { jobId }, person)) as {
        stage: string
      }
      expect(stayed.stage).toBe("saved")

      const names = (await registry.tools(coach))
        .map((entry) => entry.name)
        .sort()
      expect(names).toEqual(coachToolNames)
      expect(names).not.toContain("chat.open")
      expect(names).not.toContain("account.delete")
      expect(names).not.toContain("profile.update")
      expect(names).not.toContain("inbox.send")
      expect(names).not.toContain("inbox.addToCalendar")
    })
    const rows = await db.select().from(user).where(eq(user.id, userId))
    expect(rows).toHaveLength(1)
    await client.close()
  })
})
