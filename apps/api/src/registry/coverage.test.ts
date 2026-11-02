import {
  accountContract,
  chatContract,
  coachActor,
  inboxContract,
  jobContract,
  paperContract,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { idempotency, jobChecklist, paperShares, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { accountCases } from "./coverage-account.js"
import { chatCases } from "./coverage-chat.js"
import { idOf, type CoverageTools } from "./coverage-helpers.js"
import { inboxCases } from "./coverage-inbox.js"
import { jobCases } from "./coverage-job.js"
import { paperCases } from "./coverage-paper.js"
import { installRegistry } from "./install.js"
import type { ExecuteResult, Registry } from "./registry.js"

const surfaces = {
  account: accountContract,
  chat: chatContract,
  inbox: inboxContract,
  job: jobContract,
  paper: paperContract,
}

function coverageProblems(covered: string[]) {
  const bound = new Set(installRegistry().commandNames())
  const problems: string[] = []
  for (const name of [...bound].sort()) {
    if (covered.includes(name)) continue
    const surface = Object.entries(surfaces).find(
      ([, contract]) => name in contract
    )?.[0]
    problems.push(
      `${name} has no coverage case. Add one to apps/api/src/registry/coverage-${surface ?? "<surface>"}.ts (arrange, act, assert, undoAssert if it has a reversal).`
    )
  }
  for (const name of [...new Set(covered)].sort()) {
    if (!bound.has(name))
      problems.push(
        `${name} has a coverage case but no registered command. Delete the case or bind the command.`
      )
  }
  const repeated = covered.filter((name, i) => covered.indexOf(name) !== i)
  for (const name of new Set(repeated))
    problems.push(`${name} has more than one coverage case. Keep one.`)
  return problems
}

describe("every command has a coverage case that runs it as the person and undoes a reversal", () => {
  it("runs every command as the person and undoes a reversal", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-coverage"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-coverage@example.com",
    })
    const person = personActor(userId)
    const ctx = {
      chatId: "",
      jobId: "",
      docId: "",
      itemId: "",
      pendingId: "",
      activityId: "",
      fileId: "",
    }
    const run = (name: string, input: unknown) =>
      registry.execute({ name, input, actor: person })
    const jobOf = (jobId: string) => registry.read("job.get", { jobId }, person)
    const chatOf = (chatId: string) =>
      registry.read("chat.get", { chatId }, person)
    const paperOf = (docId: string) =>
      registry.read("paper.get", { docId }, person)
    const profileOf = () => registry.read("profile.get", {}, person)

    async function undo(result: ExecuteResult) {
      const plan = result.reversal
      if (!plan) throw new Error("missing reversal")
      await registry.execute({
        name: plan.command,
        input: plan.input,
        actor: person,
        skipConfirm: true,
      })
    }

    async function gone(read: Promise<unknown>) {
      await expect(read).rejects.toThrow(/not found/i)
    }

    async function checklist(itemId: string) {
      return db.select().from(jobChecklist).where(eq(jobChecklist.id, itemId))
    }

    async function shares(docId: string) {
      return db.select().from(paperShares).where(eq(paperShares.docId, docId))
    }

    const tools: CoverageTools = {
      db,
      registry,
      userId,
      ctx,
      run,
      undo,
      jobOf,
      chatOf,
      paperOf,
      profileOf,
      gone,
      checklist,
      shares,
    }
    const cases = [
      ...chatCases(tools),
      ...paperCases(tools),
      ...jobCases(tools),
      ...inboxCases(tools),
      ...accountCases(tools),
    ]

    await withDatabase(db, async () => {
      for (const row of cases) {
        await row.arrange()
        const result = await row.act()
        await row.assert(result)
        if (row.undoAssert) await row.undoAssert(result)
      }
      expect(coverageProblems(cases.map((row) => row.name))).toEqual([])
    })
    await client.close()
  })

  it("stores an idempotency key when a command writes no activity", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-idem"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-idem@example.com",
    })
    const person = personActor(userId)
    await withDatabase(db, async () => {
      const first = await registry.execute({
        name: "notify.request",
        input: { topic: "jobs" },
        actor: person,
        idempotencyKey: "notify-1",
      })
      expect(first.activityId).toBeNull()
      const second = await registry.execute({
        name: "notify.request",
        input: { topic: "jobs" },
        actor: person,
        idempotencyKey: "notify-1",
      })
      expect(second.output).toEqual(first.output)
      const rows = await db
        .select()
        .from(idempotency)
        .where(eq(idempotency.userId, userId))
      expect(rows.map((row) => row.key)).toContain("notify-1")
    })
    await client.close()
  })

  it("hides coach tools when the profile toggles are off", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry: Registry = installRegistry()
    const userId = "user-gates"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-gates@example.com",
    })
    await withDatabase(db, async () => {
      const person = personActor(userId)
      const chat = await registry.execute({
        name: "chat.create",
        input: {},
        actor: person,
      })
      const coach = coachActor(userId, idOf(chat.output))
      await db
        .update(user)
        .set({ agentCvs: false, agentInterview: false, agentEmail: false })
        .where(eq(user.id, userId))
      const names = (await registry.tools(coach)).map((entry) => entry.name)
      expect(names).toContain("job.move")
      expect(names).not.toContain("paper.replace")
      expect(names).not.toContain("job.addChecklistItem")
      expect(names).not.toContain("job.setChecklistItem")
      expect(names).not.toContain("job.removeChecklistItem")
      expect(names).not.toContain("inbox.scan")
      expect(names).not.toContain("inbox.send")
    })
    await client.close()
  })
})
