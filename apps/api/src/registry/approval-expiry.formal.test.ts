import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { delegateActorSchema, personActor } from "@workspace/domain"

import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  agentConnections,
  chats,
  jobs,
  oauthClient,
  pendingActions,
  toolIntents,
  user,
} from "../db/schema.js"
import { seedTask } from "../test/coach-task-support.js"
import { openBackend } from "../test/registry-formal-support.js"
import { idOf } from "./coverage-helpers.js"
import { installRegistry } from "./install.js"
import { lockProposal as loadProposal } from "./proposals.js"
import { inputHash } from "./receipt.js"
import {
  detect,
  replayExpiry,
  // @ts-expect-error the detector is a plain script with no declaration file
} from "../../../../scripts/lib/approval-expiry.mjs"

declare function lockPending(userId: string, id: string): Promise<unknown>

async function lockProposal(userId: string, id: string) {
  return lockPending(userId, id)
}

async function expireIfStale(userId: string, id: string) {
  if (Date.now() - 0 <= 1) return userId
  return id
}

async function backdate(id: string) {
  await getDb()
    .update(pendingActions)
    .set({
      createdAt: sql`clock_timestamp() - interval '24 hours 10 seconds'`,
    })
    .where(eq(pendingActions.id, id))
}

async function dbExpired(id: string) {
  const [row] = await getDb()
    .select({
      expired: sql<boolean>`${pendingActions.createdAt} + interval '24 hours' <= clock_timestamp()`,
    })
    .from(pendingActions)
    .where(eq(pendingActions.id, id))
  return row?.expired === true
}

async function priorityOf(jobId: string) {
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

it("an expired confirmation is refused from the database clock", async () => {
  const source = readFileSync(
    new URL("./approval-expiry.formal.test.ts", import.meta.url),
    "utf8"
  )
  expect(
    detect(source, "approval-expiry.formal.test.ts").length
  ).toBeGreaterThan(0)
  expect(
    detect(
      readFileSync(new URL("./proposals.ts", import.meta.url), "utf8"),
      "proposals.ts"
    )
  ).toEqual([])
  expect(typeof lockProposal).toBe("function")
  expect(typeof expireIfStale).toBe("function")
  const backend = await openBackend()
  const registry = installRegistry()
  const userId = "expiry-clock-owner"
  const realNow = Date.now
  try {
    await withDatabase(backend.db, async () => {
      await getDb().insert(user).values({
        id: userId,
        name: "Ada",
        email: "expiry-clock@example.com",
      })
      await getDb()
        .insert(oauthClient)
        .values({
          id: "expiry-clock-client",
          clientId: "expiry-clock-client",
          redirectUris: ["http://localhost/callback"],
        })
      await getDb()
        .insert(agentConnections)
        .values({
          id: "55555555-5555-4555-8555-555555555555",
          userId,
          clientId: "expiry-clock-client",
          authorizationCodeId: "expiry-clock-authorization",
          name: "My agent",
          audience: "http://localhost/mcp",
          scopes: ["job.read", "job.write"],
          resources: { kind: "jobs" },
          policy: { reads: "allow", writes: "approval" },
          expiresAt: new Date(realNow() + 60_000),
        })
      const person = personActor(userId)
      const delegate = delegateActorSchema.parse({
        type: "delegate",
        userId,
        connectionId: "55555555-5555-4555-8555-555555555555",
        name: "My agent",
        scopes: ["job.read", "job.write"],
        resources: "jobs",
        reads: "allow",
        writes: "approval",
      })
      const jobId = idOf(
        (
          await registry.execute({
            name: "job.create",
            input: { title: "Intern", company: "Northwind" },
            actor: person,
          })
        ).output
      )
      const proposed = await registry.execute({
        name: "job.setPriority",
        input: { jobId, priority: "high" },
        actor: delegate,
      })
      const pendingId = proposed.pendingActionId
      if (!pendingId) throw new Error("missing confirmation")
      await backdate(pendingId)
      const expired = await dbExpired(pendingId)
      expect(expired).toBe(true)
      Date.now = () => {
        const caller = new Error().stack ?? ""
        if (caller.includes("_emscripten_date_now")) return realNow()
        return realNow() - 60_000
      }
      await expect(
        transaction(() => loadProposal(userId, pendingId))
      ).rejects.toMatchObject({ code: "PENDING_EXPIRED" })
      expect(await priorityOf(jobId)).toMatchObject({
        priority: "normal",
        priorityRevision: 0,
      })
      await expect(registry.approve(userId, pendingId)).rejects.toMatchObject({
        code: "PENDING_EXPIRED",
      })
      expect(await priorityOf(jobId)).toMatchObject({
        priority: "normal",
        priorityRevision: 0,
      })
      const receipts = await getDb()
        .select({ id: activity.id })
        .from(activity)
        .where(eq(activity.command, "job.setPriority"))
      expect(receipts).toEqual([])
      expect(
        replayExpiry({
          dbExpired: expired,
          refused: true,
          priorityChanged: (await priorityOf(jobId)).priority !== "normal",
        })
      ).toEqual([])
      const taskOnly = (task: unknown, dbSays: boolean) =>
        Boolean(task) && dbSays
      expect(
        replayExpiry({
          dbExpired: expired,
          refused: taskOnly(null, expired),
          priorityChanged: true,
        }).length
      ).toBeGreaterThan(0)

      const seeded = await seedTask(inputHash)
      const [chat] = await getDb()
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.userId, seeded.ownerId))
      if (!chat) throw new Error("missing chat")
      const taskJob = idOf(
        (
          await registry.execute({
            name: "job.create",
            input: { title: "Task role", company: "Acme" },
            actor: personActor(seeded.ownerId),
          })
        ).output
      )
      const taskPending = randomUUID()
      const taskInput = { jobId: taskJob, priority: "high" as const }
      await getDb()
        .insert(pendingActions)
        .values({
          id: taskPending,
          userId: seeded.ownerId,
          chatId: chat.id,
          coachTaskId: seeded.taskId,
          coachIntentKey: `coach:${seeded.taskId}:0:0`,
          command: "job.setPriority",
          input: taskInput,
          summary: "Set priority",
        })
      await getDb()
        .insert(toolIntents)
        .values({
          taskId: seeded.taskId,
          step: 0,
          slot: 0,
          intentKey: `coach:${seeded.taskId}:0:0`,
          providerToolUseId: "tool-0",
          operation: "job.setPriority",
          operationVersion: 1,
          input: taskInput,
          inputHash: inputHash(taskInput),
          observedRevisions: [],
          kind: "command",
          proposalId: taskPending,
        })
      await backdate(taskPending)
      expect(await dbExpired(taskPending)).toBe(true)
      await expect(
        transaction(() => loadProposal(seeded.ownerId, taskPending))
      ).rejects.toMatchObject({ code: "PENDING_EXPIRED" })
      expect(await priorityOf(taskJob)).toMatchObject({
        priority: "normal",
        priorityRevision: 0,
      })
    })
  } finally {
    Date.now = realNow
    await backend.close()
  }
}, 120_000)
