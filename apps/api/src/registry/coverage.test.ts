import { jobContract, paperContract, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { idempotency, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { idOf } from "./coverage-helpers.test-support.js"
import { coverageCases } from "./coverage-setup.test-support.js"
import { installRegistry } from "../install.js"
import type { ExecuteResult, Registry } from "./registry.js"
import { coachActivityWithoutTurn, seedCoachActor } from "../test/coach-turn.js"

const surfaces = {
  job: jobContract,
  paper: paperContract,
}

const REVERSAL_WITHOUT_ACTIVITY_PENDING = {
  issue: 916,
  expires: "2026-12-01",
  commands: ["paper.rename", "paper.setTemplate", "paper.share"],
}

function reversalWithoutActivity(ran: [string, ExecuteResult][]) {
  return ran
    .filter(([, result]) => result.reversal && !result.activityId)
    .map(([name]) => name)
    .sort()
}

function unlistedReversalWithoutActivity(
  offenders: string[],
  pending: string[]
) {
  return offenders
    .filter((name) => !pending.includes(name))
    .map(
      (name) =>
        `${name} returns a reversal but writes no activity row, so the receipt says Reversible and shows no Undo. Write an activity row, or return no reversal.`
    )
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
    const userId = "user-coverage"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-coverage@example.com",
    })
    const { cases } = coverageCases(db, userId)
    const ran: [string, ExecuteResult][] = []

    await withDatabase(db, async () => {
      for (const row of cases) {
        await row.arrange()
        const result = await row.act()
        ran.push([row.name, result])
        await row.assert(result)
        if (row.undoAssert) await row.undoAssert(result)
      }
      expect(coverageProblems(cases.map((row) => row.name))).toEqual([])
      expect(await coachActivityWithoutTurn()).toEqual([])
      const offenders = reversalWithoutActivity(ran)
      expect(
        unlistedReversalWithoutActivity(
          offenders,
          REVERSAL_WITHOUT_ACTIVITY_PENDING.commands
        )
      ).toEqual([])
      expect(
        REVERSAL_WITHOUT_ACTIVITY_PENDING.commands.filter(
          (name) => !offenders.includes(name)
        ),
        "pending commands that no longer offend: remove them from the list"
      ).toEqual([])
      expect(
        Date.parse(REVERSAL_WITHOUT_ACTIVITY_PENDING.expires)
      ).toBeGreaterThan(Date.now())
    })
    await client.close()
  })

  it("a reversal with no activity row is reported", () => {
    const withReversal = {
      reversal: { command: "x.undo", input: {} },
      activityId: null,
    } as unknown as ExecuteResult
    const withBoth = {
      reversal: { command: "x.undo", input: {} },
      activityId: "a1",
    } as unknown as ExecuteResult
    const neither = {
      reversal: null,
      activityId: null,
    } as unknown as ExecuteResult
    const offenders = reversalWithoutActivity([
      ["bad", withReversal],
      ["good", withBoth],
      ["plain", neither],
    ])
    expect(offenders).toEqual(["bad"])
    expect(unlistedReversalWithoutActivity(offenders, [])).toHaveLength(1)
    expect(unlistedReversalWithoutActivity(offenders, ["bad"])).toEqual([])
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
      const coach = await seedCoachActor(userId, idOf(chat.output))
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
