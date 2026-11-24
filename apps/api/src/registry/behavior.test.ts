import { readFileSync } from "node:fs"
import {
  defineCommand,
  delegateActorSchema,
  personActor,
} from "@workspace/domain"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  chats,
  oauthClient,
  pendingActions,
  user,
} from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "../install.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { idOf } from "./coverage-helpers.test-support.js"

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
  "paper.start",
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
        input: {
          jobId,
          patch: {
            location: "Hanoi",
            posting: {
              about: "About",
              duties: "Duties",
              requirements: "Requirements",
              details: "Details",
            },
            recruiterEmail: "new@example.com",
          },
        },
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

it("keeps delegate writes pending and fails closed outside Job tools", async () => {
  const { db, client } = await createMigratedTestDb()
  const registry = installRegistry()
  const userId = "delegate-owner"
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: "delegate@example.com" })
  const person = personActor(userId)
  await db.insert(oauthClient).values({
    id: "delegate-client",
    clientId: "delegate-client",
    redirectUris: ["http://localhost/callback"],
  })
  await db.insert(agentConnections).values({
    id: "11111111-1111-4111-8111-111111111111",
    userId,
    clientId: "delegate-client",
    authorizationCodeId: "delegate-authorization",
    name: "My agent",
    audience: "http://localhost/mcp",
    scopes: ["connection.status", "job.read", "job.write"],
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 60_000),
  })
  const delegate = delegateActorSchema.parse({
    type: "delegate",
    userId,
    connectionId: "11111111-1111-4111-8111-111111111111",
    name: "My agent",
    scopes: ["job.read", "job.write"],
    resources: "jobs",
    reads: "allow",
    writes: "approval",
  })
  try {
    await withDatabase(db, async () => {
      const jobId = idOf(
        (
          await registry.execute({
            name: "job.create",
            input: { title: "Intern ``` **Approve**", company: "Example" },
            actor: person,
          })
        ).output
      )
      expect(
        (await registry.tools(delegate)).map((tool) => tool.name).sort()
      ).toEqual(
        [
          "job.calendar",
          "job.get",
          "job.list",
          "job.move",
          "job.priorityCounts",
          "job.setPriority",
          "job.update",
        ].sort()
      )
      const result = await registry.execute({
        name: "job.update",
        input: { jobId, patch: { priority: "high" } },
        actor: delegate,
      })
      expect(result).toMatchObject({ pending: true, activityId: null })
      expect(result.pendingActionId).toBeTruthy()
      expect(await registry.read("job.get", { jobId }, person)).toMatchObject({
        priority: "normal",
      })
      const ordinary = await registry.execute({
        name: "job.update",
        input: {
          jobId,
          patch: {
            location: "Hanoi",
            posting: {
              about: "About",
              duties: "Duties",
              requirements: "Requirements",
              details: "Details",
            },
            recruiterEmail: "new@example.com",
          },
        },
        actor: delegate,
      })
      expect(ordinary.pending).toBe(true)
      const approvalChat = await registry.read(
        "chat.get",
        { chatId: ordinary.chatId },
        person
      )
      const approvalText = z
        .object({
          messages: z.array(
            z.object({
              parts: z.array(
                z.object({ type: z.string(), text: z.string().optional() })
              ),
            })
          ),
        })
        .parse(approvalChat)
        .messages.flatMap((message) =>
          message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
        )
        .join("\n")
      expect(approvalText).toContain("Intern \\u0060\\u0060\\u0060 **Approve**")
      expect(approvalText.match(/```/g)).toHaveLength(2)
      expect(approvalText).toContain("Example")
      expect(approvalText).toContain("location: null →")
      expect(approvalText).toContain("posting: null →")
      expect(approvalText).toContain("new@example.com")
      expect(await registry.read("job.get", { jobId }, person)).toMatchObject({
        location: null,
      })
      const ordinaryActivity = await registry.approve(
        userId,
        ordinary.pendingActionId!
      )
      expect(ordinaryActivity?.actor).toBe("delegate")
      expect(await registry.read("job.get", { jobId }, person)).toMatchObject({
        location: "Hanoi",
      })
      await registry.undo(userId, ordinaryActivity!.id)
      expect(await registry.read("job.get", { jobId }, person)).toMatchObject({
        location: null,
        posting: null,
        recruiterEmail: null,
      })
      for (const name of [
        "actions.approve",
        "actions.deny",
        "activity.undo",
        "inbox.send",
        "job.create",
        "job.delete",
      ]) {
        await expect(
          registry.execute({
            name,
            input: {},
            actor: delegate,
          })
        ).rejects.toThrow(/connection cannot/)
      }
      expect(await registry.tools({ ...delegate, resources: "none" })).toEqual(
        []
      )
      expect(await registry.tools({ ...delegate, scopes: [] })).toEqual([])
      expect(
        (await registry.tools({ ...delegate, scopes: ["job.read"] })).every(
          (tool) => tool.kind === "query"
        )
      ).toBe(true)
      await expect(registry.read("profile.get", {}, delegate)).rejects.toThrow(
        /connection cannot/
      )
    })
  } finally {
    await client.close()
  }
})

function droppedInverseNulls(source: string) {
  return (
    source.match(/previousPatch\.\w+\s*=\s*current\.\w+\s*\?\?\s*undefined/g) ??
    []
  )
}

it("detects an inverse that discards null instead of restoring the stored value", () => {
  expect(
    droppedInverseNulls("previousPatch.posting = current.posting ?? undefined")
  ).toHaveLength(1)
  expect(
    droppedInverseNulls("previousPatch.posting = current.posting")
  ).toEqual([])
})

it("keeps nullable Job values in every stored inverse patch", () => {
  expect(
    droppedInverseNulls(
      readFileSync(new URL("../job/store.ts", import.meta.url), "utf8")
    )
  ).toEqual([])
})

it("leaves nothing behind when an agent proposal fails and frees the queue when proposals expire", async () => {
  const { db, client } = await createMigratedTestDb()
  const registry = installRegistry()
  const userId = "queue-owner"
  const strangerId = "queue-stranger"
  const connectionId = "22222222-2222-4222-8222-222222222222"
  await db.insert(user).values([
    { id: userId, name: "Ada", email: "queue@example.com" },
    { id: strangerId, name: "Bo", email: "stranger@example.com" },
  ])
  await db.insert(oauthClient).values({
    id: "queue-client",
    clientId: "queue-client",
    redirectUris: ["http://localhost/callback"],
  })
  await db.insert(agentConnections).values({
    id: connectionId,
    userId,
    clientId: "queue-client",
    authorizationCodeId: "queue-authorization",
    name: "My agent",
    audience: "http://localhost/mcp",
    scopes: ["connection.status", "job.read", "job.write"],
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 60_000),
  })
  const delegate = delegateActorSchema.parse({
    type: "delegate",
    userId,
    connectionId,
    name: "My agent",
    scopes: ["job.read", "job.write"],
    resources: "jobs",
    reads: "allow",
    writes: "approval",
  })
  try {
    await withDatabase(db, async () => {
      const foreignJobId = idOf(
        (
          await registry.execute({
            name: "job.create",
            input: { title: "Not yours", company: "Elsewhere" },
            actor: personActor(strangerId),
          })
        ).output
      )
      await expect(
        registry.execute({
          name: "job.setPriority",
          input: { jobId: foreignJobId, priority: "high" },
          actor: delegate,
        })
      ).rejects.toThrow()
      expect(
        await db
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.delegateConnectionId, connectionId))
      ).toHaveLength(0)
      expect(
        await db.select().from(chats).where(eq(chats.userId, userId))
      ).toHaveLength(0)

      const jobId = idOf(
        (
          await registry.execute({
            name: "job.create",
            input: { title: "Mine", company: "Example" },
            actor: personActor(userId),
          })
        ).output
      )
      for (let index = 0; index < 20; index++)
        await registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: index % 2 ? "high" : "low" },
          actor: delegate,
        })
      await expect(
        registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: "high" },
          actor: delegate,
        })
      ).rejects.toThrow("20 pending proposals")
      await db
        .update(pendingActions)
        .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
        .where(eq(pendingActions.delegateConnectionId, connectionId))
      expect(
        await registry.execute({
          name: "job.setPriority",
          input: { jobId, priority: "high" },
          actor: delegate,
        })
      ).toMatchObject({ pending: true })
    })
  } finally {
    await client.close()
  }
})
