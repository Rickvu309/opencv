import { type InboxDetail } from "@workspace/domain/inbox"
import { coachActor, personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { loadFixtureThreads } from "./fixture.js"
import {
  activity,
  chatMessages,
  chats,
  inboxMessages,
  inboxThreads,
  user,
} from "../db/schema.js"
import { installRegistry } from "../install.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import { createId } from "../platform/id.js"

describe("inbox commands", () => {
  it("scans once and does not duplicate threads or messages", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-scan"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-scan@example.com",
    })
    await withDatabase(db, async () => {
      const actor = personActor(userId)
      await registry.execute({ name: "inbox.scan", input: {}, actor })
      const once = await db.select().from(inboxMessages)
      await registry.execute({ name: "inbox.scan", input: {}, actor })
      const twice = await db.select().from(inboxMessages)
      const threads = await db
        .select()
        .from(inboxThreads)
        .where(eq(inboxThreads.userId, userId))
      expect(threads).toHaveLength(6)
      expect(new Set(threads.map((row) => row.providerThreadId)).size).toBe(6)
      expect(twice).toHaveLength(once.length)
      expect(once).toHaveLength(3)
    })
    await client.close()
  })

  it("preserves provider read state on the first scan", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const fixture = loadFixtureThreads().find(
      (thread) => thread.id === "regional-bank"
    )
    if (!fixture) throw new Error("missing Regional bank fixture")
    const previousUnread = fixture.unread
    fixture.unread = false
    const userId = "user-inbox-first-read"
    await db
      .insert(user)
      .values({ id: userId, name: "Ada", email: "ada-first-read@example.com" })
    try {
      await withDatabase(db, async () => {
        const actor = personActor(userId)
        await registry.execute({ name: "inbox.scan", input: {}, actor })
        const [thread] = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.providerThreadId, fixture.id))
        expect(thread).toMatchObject({ unread: false })
      })
    } finally {
      fixture.unread = previousUnread
      await client.close()
    }
  })

  it("keeps a sent thread read when a scan finds no new incoming message", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-reply-read"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-reply-read@example.com",
    })
    await withDatabase(db, async () => {
      const actor = personActor(userId)
      const scanned = await registry.execute({
        name: "inbox.scan",
        input: {},
        actor,
      })
      const rows = (
        scanned.output as { threads: { id: string; role: string }[] }
      ).threads
      const thread = rows.find((row) => row.role === "Business Analyst")
      if (!thread) throw new Error("missing Business Analyst thread")
      await registry.execute({
        name: "inbox.updateDraft",
        input: { threadId: thread.id, body: "Thanks for the update." },
        actor,
      })
      await registry.execute({
        name: "inbox.send",
        input: { threadId: thread.id },
        actor,
      })
      await registry.execute({ name: "inbox.scan", input: {}, actor })
      const detail = await registry.read(
        "inbox.get",
        { threadId: thread.id },
        actor
      )
      expect(detail).toMatchObject({ unread: false })
    })
    await client.close()
  })

  it("marks a read thread unread for a new incoming id at the same timestamp", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-new-incoming"
    const fixture = loadFixtureThreads().find(
      (thread) => thread.id === "regional-bank"
    )
    if (!fixture) throw new Error("missing Regional bank fixture")
    const messageCount = fixture.messages.length
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-new-incoming@example.com",
    })
    try {
      await withDatabase(db, async () => {
        const actor = personActor(userId)
        const scanned = await registry.execute({
          name: "inbox.scan",
          input: {},
          actor,
        })
        const thread = (
          scanned.output as { threads: { id: string; role: string }[] }
        ).threads.find((row) => row.role === "Business Analyst")
        if (!thread) throw new Error("missing Business Analyst thread")
        await registry.execute({
          name: "inbox.updateDraft",
          input: { threadId: thread.id, body: "Thanks for the update." },
          actor,
        })
        await registry.execute({
          name: "inbox.send",
          input: { threadId: thread.id },
          actor,
        })
        await registry.execute({ name: "inbox.scan", input: {}, actor })
        expect(
          await registry.read("inbox.get", { threadId: thread.id }, actor)
        ).toMatchObject({ unread: false })

        const latestIncoming = fixture.messages
          .filter((message) => message.direction === "in")
          .at(-1)
        if (!latestIncoming) throw new Error("missing incoming fixture message")
        fixture.messages.push({
          ...latestIncoming,
          id: "regional-bank-in-same-time-new-id",
        })
        await registry.execute({ name: "inbox.scan", input: {}, actor })
        expect(
          await registry.read("inbox.get", { threadId: thread.id }, actor)
        ).toMatchObject({ unread: true })
      })
    } finally {
      fixture.messages.splice(messageCount)
      await client.close()
    }
  })

  it("delegates the interview move to job.move", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-move"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-move@example.com",
    })
    await withDatabase(db, async () => {
      const actor = personActor(userId)
      const created = await registry.execute({
        name: "job.create",
        input: {
          title: "Associate PM",
          company: "Local startup",
          stage: "applied",
        },
        actor,
      })
      const jobId = (created.output as { id: string }).id
      const scanned = await registry.execute({
        name: "inbox.scan",
        input: {},
        actor,
      })
      const threads = (
        scanned.output as {
          threads: {
            id: string
            role: string
            jobId: string | null
            suggestedStage: string | null
          }[]
        }
      ).threads
      const row = threads.find((thread) => thread.role === "Associate PM")
      expect(row?.jobId).toBe(jobId)
      expect(row?.suggestedStage).toBe("interview")
      const accepted = await registry.execute({
        name: "inbox.acceptSuggestion",
        input: { threadId: row?.id },
        actor,
      })
      const output = accepted.output as { activityId: string; jobId: string }
      expect(accepted.activityId).toBeNull()
      expect(output.jobId).toBe(jobId)
      const job = (await registry.read("job.get", { jobId }, actor)) as {
        stage: string
      }
      expect(job.stage).toBe("interview")
      const rows = await db
        .select()
        .from(activity)
        .where(eq(activity.id, output.activityId))
      expect(rows[0]?.command).toBe("job.move")
      const own = await db
        .select()
        .from(activity)
        .where(eq(activity.command, "inbox.acceptSuggestion"))
      expect(own).toHaveLength(0)
    })
    await client.close()
  })

  it("omits send and calendar from the coach tools", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    await db.insert(user).values({
      id: "user-inbox-coach",
      name: "Ada",
      email: "ada-inbox-coach@example.com",
    })
    await withDatabase(db, async () => {
      const names = (
        await registry.tools(
          coachActor(
            "user-inbox-coach",
            "00000000-0000-4000-8000-0000000000aa",
            createId()
          )
        )
      ).map((entry) => entry.name)
      expect(names).not.toContain("inbox.send")
      expect(names).not.toContain("inbox.addToCalendar")
      expect(names).toContain("inbox.scan")
      expect(names).toContain("inbox.draftReply")
    })
    await client.close()
  })

  it("returns the fixture list and a closed connect url", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-inbox-http@example.com",
    })
    const headers = authHeaders(cookie)
    const connect = await app.request("/api/inbox/connect", { headers })
    expect(connect.status).toBe(200)
    expect(
      ((await connect.json()) as { data: { url: string | null } }).data
    ).toEqual({
      url: null,
    })

    const scan = await app.request("/api/commands/inbox.scan", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    expect(scan.status).toBe(200)
    const scanBody = (await scan.json()) as {
      data: {
        emailCount: number
        companyCount: number
        threads: { id: string }[]
      }
    }
    expect(scanBody.data.emailCount).toBe(6)
    expect(scanBody.data.companyCount).toBe(6)

    const list = await app.request("/api/reads/inbox.list", {
      method: "POST",
      headers,
      body: "{}",
    })
    const listBody = (await list.json()) as {
      data: {
        connected: boolean
        skipped: boolean
        threads: { id: string; role: string }[]
      }
    }
    expect(listBody.data.connected).toBe(false)
    expect(listBody.data.skipped).toBe(false)
    expect(listBody.data.threads).toHaveLength(6)

    const detailId = listBody.data.threads.find(
      (thread) => thread.role === "Business Analyst"
    )?.id
    const detail = await app.request("/api/reads/inbox.get", {
      method: "POST",
      headers,
      body: JSON.stringify({ threadId: detailId }),
    })
    const detailBody = (await detail.json()) as {
      data: { draft: { body: string } | null; openUrl: string | null }
    }
    expect(detailBody.data.draft?.body).toMatch(/14:30/)
    expect(detailBody.data.openUrl).toBeNull()

    const skip = await app.request("/api/commands/inbox.skip", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    expect(skip.status).toBe(200)
    const after = (await (
      await app.request("/api/reads/inbox.list", {
        method: "POST",
        headers,
        body: "{}",
      })
    ).json()) as {
      data: { skipped: boolean }
    }
    expect(after.data.skipped).toBe(true)
    await client.close()
  })

  it("hides private undo fields and a future snooze, then brings the thread back", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-inbox-snooze@example.com",
    })
    const headers = {
      ...authHeaders(cookie),
      "content-type": "application/json",
    }
    await db
      .update(user)
      .set({ timeZone: "Asia/Singapore" })
      .where(eq(user.email, "ada-inbox-snooze@example.com"))
    const scan = await app.request("/api/commands/inbox.scan", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    expect(scan.status).toBe(200)
    const listed = (await (
      await app.request("/api/reads/inbox.list", {
        method: "POST",
        headers,
        body: "{}",
      })
    ).json()) as {
      data: {
        timeZone: string
        threads: { id: string; role: string }[]
      }
    }
    expect(listed.data.timeZone).toBe("Asia/Singapore")
    expect(listed.data.threads).toHaveLength(6)
    const snoozeId = listed.data.threads.find(
      (thread) => thread.role === "Growth Marketer"
    )?.id
    const doneId = listed.data.threads.find(
      (thread) => thread.role === "Content Specialist"
    )?.id
    const snoozed = await app.request("/api/commands/inbox.snooze", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { threadId: snoozeId, until: "2099-01-01T00:00:00.000Z" },
      }),
    })
    const snoozeBody = (await snoozed.json()) as {
      data: Record<string, unknown>
    }
    expect(snoozed.status).toBe(200)
    expect(snoozeBody.data).not.toHaveProperty("previousStatus")
    expect(snoozeBody.data).not.toHaveProperty("previousSnoozeUntil")
    expect(snoozeBody.data).not.toHaveProperty("previousStage")
    const hidden = (await (
      await app.request("/api/reads/inbox.list", {
        method: "POST",
        headers,
        body: "{}",
      })
    ).json()) as { data: { threads: { id: string }[] } }
    expect(hidden.data.threads.map((thread) => thread.id)).not.toContain(
      snoozeId
    )
    expect(hidden.data.threads).toHaveLength(5)
    const returned = await app.request("/api/commands/inbox.snooze", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { threadId: snoozeId, until: "2000-01-01T00:00:00.000Z" },
      }),
    })
    expect(returned.status).toBe(200)
    const visible = (await (
      await app.request("/api/reads/inbox.list", {
        method: "POST",
        headers,
        body: "{}",
      })
    ).json()) as { data: { threads: { id: string }[] } }
    expect(visible.data.threads.map((thread) => thread.id)).toContain(snoozeId)
    const done = await app.request("/api/commands/inbox.markDone", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { threadId: doneId } }),
    })
    const doneBody = (await done.json()) as {
      data: Record<string, unknown>
    }
    expect(done.status).toBe(200)
    expect(doneBody.data).not.toHaveProperty("previousStatus")
    expect(doneBody.data).not.toHaveProperty("previousSnoozeUntil")
    expect(doneBody.data).not.toHaveProperty("previousStage")
    expect(doneBody.data.activityId).toEqual(expect.any(String))
    const afterDone = (await (
      await app.request("/api/reads/inbox.list", {
        method: "POST",
        headers,
        body: "{}",
      })
    ).json()) as { data: { threads: { id: string }[] } }
    expect(afterDone.data.threads.map((thread) => thread.id)).not.toContain(
      doneId
    )
    const undone = await app.request("/api/commands/activity.undo", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { activityId: doneBody.data.activityId } }),
    })
    expect(undone.status).toBe(200)
    const row = await db
      .select()
      .from(inboxThreads)
      .where(eq(inboxThreads.id, doneId ?? ""))
    expect(row[0]?.status).toBe("open")
    await client.close()
  })

  it("reuses one Inbox reply chat for a second hint", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-hint"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-hint@example.com",
    })
    const previous = process.env.COACH_RUNTIME
    process.env.COACH_RUNTIME = "fake"
    try {
      await withDatabase(db, async () => {
        const actor = personActor(userId)
        const scanned = await registry.execute({
          name: "inbox.scan",
          input: {},
          actor,
        })
        const threadId = (
          scanned.output as { threads: { id: string; role: string }[] }
        ).threads.find((thread) => thread.role === "Business Analyst")?.id
        await registry.execute({
          name: "inbox.draftReply",
          input: { threadId, hint: "another time" },
          actor,
        })
        await registry.execute({
          name: "inbox.draftReply",
          input: { threadId, hint: "a later day" },
          actor,
        })
        const drafted = (await registry.read(
          "inbox.get",
          { threadId },
          actor
        )) as InboxDetail
        expect(drafted.draft?.body).toContain("Thanks for reaching out")
        expect(drafted.draft?.body).not.toContain("Apply")
        const rows = await db
          .select()
          .from(chats)
          .where(eq(chats.userId, userId))
        const inboxChats = rows.filter(
          (chat) => chat.title === "Inbox reply" && chat.focusId === threadId
        )
        expect(inboxChats).toHaveLength(1)
        const messages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.chatId, inboxChats[0]?.id ?? ""))
        expect(
          messages.filter((message) => message.role === "person")
        ).toHaveLength(2)
      })
    } finally {
      if (previous === undefined) delete process.env.COACH_RUNTIME
      else process.env.COACH_RUNTIME = previous
    }
    await client.close()
  })
})
