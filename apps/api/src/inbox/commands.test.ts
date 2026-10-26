import { coachActor, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { activity, inboxMessages, inboxThreads, user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

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
    await withDatabase(db, async () => {
      const names = (
        await registry.tools(
          coachActor("user-inbox-coach", "00000000-0000-4000-8000-0000000000aa")
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

    const list = await app.request("/api/inbox", { headers })
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
    const detail = await app.request(`/api/inbox/${detailId}`, { headers })
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
      await app.request("/api/inbox", { headers })
    ).json()) as {
      data: { skipped: boolean }
    }
    expect(after.data.skipped).toBe(true)
    await client.close()
  })
})
