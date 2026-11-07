import { connectionsCases } from "./coverage-connections.js"
import { catalog, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import type { TestDatabase } from "../db/context.js"
import { jobChecklist, paperShares } from "../db/schema.js"
import { accountCases } from "./coverage-account.js"
import { coachCases } from "./coverage-coach.js"
import { chatCases } from "./coverage-chat.js"
import {
  idOf,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.js"
import { inboxCases } from "./coverage-inbox.js"
import { jobCases } from "./coverage-job.js"
import { paperCases } from "./coverage-paper.js"
import { installRegistry } from "./install.js"
import type { ExecuteResult, Registry } from "./registry.js"

type Run = CoverageTools["run"]
type Undo = CoverageTools["undo"]

export type CoverageWrappers = {
  run?: (inner: Run) => Run
  undo?: (inner: Undo, registry: Registry) => Undo
}

export function coverageCases(
  db: TestDatabase,
  userId: string,
  wrappers: CoverageWrappers = {}
) {
  const registry = installRegistry()
  const person = personActor(userId)
  const ctx = {
    chatId: "",
    jobId: "",
    docId: "",
    otherDocId: "",
    itemId: "",
    pendingId: "",
    activityId: "",
    fileId: "",
  }
  const plainRun: Run = (name, input) =>
    registry.execute({ name, input, actor: person })
  const run = wrappers.run ? wrappers.run(plainRun) : plainRun

  const plainUndo: Undo = async (result: ExecuteResult) => {
    const plan = result.reversal
    if (!plan) throw new Error("missing reversal")
    if (result.activityId) {
      await registry.undo(userId, result.activityId)
      return
    }
    await registry.execute({
      name: plan.command,
      input: plan.input,
      actor: person,
      skipConfirm: true,
    })
  }
  const undo = wrappers.undo ? wrappers.undo(plainUndo, registry) : plainUndo

  const tools: CoverageTools = {
    db,
    registry,
    userId,
    ctx,
    run,
    undo,
    jobOf: (jobId) => registry.read("job.get", { jobId }, person),
    chatOf: (chatId) => registry.read("chat.get", { chatId }, person),
    paperOf: (docId) => registry.read("paper.get", { docId }, person),
    profileOf: () => registry.read("profile.get", {}, person),
    gone: async (read) => {
      await expect(read).rejects.toThrow(/not found/i)
    },
    checklist: (itemId) =>
      db.select().from(jobChecklist).where(eq(jobChecklist.id, itemId)),
    shares: (docId) =>
      db.select().from(paperShares).where(eq(paperShares.docId, docId)),
  }
  const catalogCases: CoverageCase[] = Object.values(catalog)
    .filter((operation) => operation.kind === "command")
    .map((operation) => ({
      name: operation.name,
      arrange: async () => {
        const result = await run("job.create", {
          title: "Catalog proof",
          company: "Northwind",
        })
        ctx.jobId = idOf(result.output)
      },
      act: () =>
        run(
          operation.name,
          operation.input.parse({ jobId: ctx.jobId, priority: "high" })
        ),
      assert: async (result) => {
        expect(operation.publicResult.safeParse(result.output).success).toBe(
          true
        )
        expect(result.activityId).toBeTruthy()
        expect(await tools.jobOf(ctx.jobId)).toMatchObject({ priority: "high" })
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(await tools.jobOf(ctx.jobId)).toMatchObject({
          priority: "normal",
        })
      },
    }))
  const cases: CoverageCase[] = [
    ...catalogCases,
    ...chatCases(tools),
    ...coachCases(tools),
    ...paperCases(tools),
    ...jobCases(tools),
    ...inboxCases(tools),
    ...connectionsCases(tools),
    ...accountCases(tools),
  ]
  return { cases, registry, person }
}
