import { defineCommand, personActor } from "@workspace/domain"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "./install.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { idOf } from "./coverage-helpers.js"

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
  "job.priorityCounts",
  "job.removeChecklistItem",
  "job.setChecklistItem",
  "job.setPriority",
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

it("confirms every Coach priority writer, preserves automatic updates, and guards Undo", async () => {
  const { db, client } = await createMigratedTestDb()
  const registry = installRegistry()
  const userId = "priority-owner"
  await db.insert(user).values([
    { id: userId, name: "Ada", email: "priority@example.com" },
    {
      id: "other-priority-owner",
      name: "Other",
      email: "other-priority@example.com",
    },
  ])
  const person = personActor(userId)
  const other = personActor("other-priority-owner")
  try {
    await withDatabase(db, async () => {
      const run = (name: string, input: unknown) =>
        registry.execute({ name, input, actor: person })
      const chatId = idOf((await run("chat.create", {})).output)
      const jobId = idOf(
        (await run("job.create", { title: "Intern", company: "Northwind" }))
          .output
      )
      const coach = await seedCoachActor(userId, chatId)
      const get = () => registry.read("job.get", { jobId }, person)
      const counts = () => registry.read("job.priorityCounts", {}, person)
      expect(await counts()).toEqual([
        { priority: "low", count: 0 },
        { priority: "normal", count: 1 },
        { priority: "high", count: 0 },
      ])
      await registry.execute({
        name: "job.create",
        input: { title: "Other", company: "Other" },
        actor: other,
      })
      expect(await counts()).toEqual([
        { priority: "low", count: 0 },
        { priority: "normal", count: 1 },
        { priority: "high", count: 0 },
      ])
      const update = await registry.execute({
        name: "job.update",
        input: { jobId, patch: { priority: "high" } },
        actor: coach,
      })
      expect(update.pending).toBe(true)
      expect(await get()).toMatchObject({ priority: "normal" })
      expect(await counts()).toContainEqual({ priority: "high", count: 0 })
      await registry.approve(userId, update.pendingActionId!)
      expect(await get()).toMatchObject({ priority: "high" })
      const automatic = await registry.execute({
        name: "job.update",
        input: { jobId, patch: { location: "Hanoi" } },
        actor: coach,
      })
      expect(automatic.pending).toBe(false)
      expect(await get()).toMatchObject({ location: "Hanoi" })
      const proposal = await registry.execute({
        name: "job.setPriority",
        input: { jobId, priority: "low" },
        actor: coach,
      })
      expect(proposal.pending).toBe(true)
      expect(await get()).toMatchObject({ priority: "high" })
      const approved = await registry.approve(userId, proposal.pendingActionId!)
      expect(await get()).toMatchObject({ priority: "low" })
      expect(await counts()).toContainEqual({ priority: "low", count: 1 })
      await registry.undo(userId, approved!.id)
      expect(await get()).toMatchObject({ priority: "high" })
      expect(await counts()).toContainEqual({ priority: "high", count: 1 })
      const earlier = await run("job.setPriority", {
        jobId,
        priority: "normal",
      })
      await run("job.update", { jobId, patch: { priority: "low" } })
      await expect(
        registry.undo(userId, earlier.activityId!)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await get()).toMatchObject({ priority: "low" })
      await run("job.delete", { jobId })
      expect(await counts()).toEqual([
        { priority: "low", count: 0 },
        { priority: "normal", count: 0 },
        { priority: "high", count: 0 },
      ])
    })
  } finally {
    await client.close()
  }
})
