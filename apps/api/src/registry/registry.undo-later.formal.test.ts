import { ERROR_CODES, parseUserId, personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { activity, user } from "../db/schema.js"
import {
  backend,
  newPerson,
  registerBackendHooks,
  registry,
} from "../test/registry-formal-support.js"
import { chatUndoLater } from "../coach/chat/undo-later.test-support.js"
import { inboxUndoLater } from "../inbox/undo-later.test-support.js"
import { jobField, jobUndoLater } from "../job/undo-later.test-support.js"
import { paperUndoLater } from "../paper/undo-later.test-support.js"
import { idOf, text } from "./coverage-helpers.test-support.js"
import { coverageCases } from "./coverage-setup.test-support.js"
import { undoKeyFor } from "./expectation.js"
import type { ExecuteResult } from "./registry.js"
import type { LaterCases, LaterWorld } from "./undo-later.test-support.js"

registerBackendHooks()

type Run = LaterWorld["run"]

const LATER: LaterCases = {
  ...jobUndoLater,
  ...paperUndoLater,
  ...inboxUndoLater,
  ...chatUndoLater,
}

function worldFor(userId: string, run: Run): LaterWorld {
  return {
    userId,
    db: backend.db,
    run,
    read: (name, input) =>
      registry.read(name, input, {
        type: "person",
        userId: parseUserId(userId),
      }),
  }
}

const OWN_UNDO_GUARD = ["paper.edit"]

type Verdict = "refused" | "kept" | "erased"

async function undoAfterLater(
  name: string,
  a: ExecuteResult,
  userId: string,
  run: Run
): Promise<Verdict> {
  const later = LATER[name]!
  const world = worldFor(userId, run)
  await later.act(a, world)
  try {
    await registry.undo(userId, a.activityId!)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === ERROR_CODES.CONFLICT) return "refused"
    throw error
  }
  return (await later.survives(a, world)) ? "kept" : "erased"
}

describe("P4: undoing an action after a later change never erases the later change", () => {
  it("offers no Undo for an import, so later typing on the imported Word page cannot be erased by it", async () => {
    await withDatabase(backend.db, async () => {
      const userId = "formal-import-later-typing"
      await backend.db.insert(user).values({
        id: userId,
        name: "Ada",
        email: "import-later-typing@example.com",
      })
      const person = personActor(userId)
      const row = coverageCases(backend.db, userId).cases.find(
        (row) => row.name === "paper.import"
      )
      if (!row) throw new Error("Missing import coverage")
      await row.arrange()
      const imported = await row.act()
      expect(imported.reversal).toBeNull()
      const docId = text(imported.output, "docId")
      if (!docId) throw new Error("Missing imported page")
      if (imported.activityId)
        await expect(
          registry.undo(userId, imported.activityId)
        ).rejects.toBeDefined()
      const outline = await registry.read("paper.outline", { docId }, person)
      expect(text(outline, "outline")).toContain("hello from an imported file")
    })
  })

  it("refuses with CONFLICT or leaves the later change intact, for every command with an Undo", async () => {
    await withDatabase(backend.db, async () => {
      const userId = "formal-undo-later"
      await backend.db.insert(user).values({
        id: userId,
        name: "Ada",
        email: "ada-coverage@example.com",
      })
      const person = personActor(userId)
      const { cases } = coverageCases(backend.db, userId)
      const run: Run = (name, input) =>
        registry.execute({ name, input, actor: person })
      const verdicts: Record<string, Verdict> = {}
      const unruled: string[] = []
      for (const row of cases) {
        await row.arrange()
        const result = await row.act()
        await row.assert(result)
        const undoable =
          Boolean(result.reversal && result.activityId) &&
          !OWN_UNDO_GUARD.includes(row.name)
        if (undoable && !LATER[row.name]) unruled.push(row.name)
        if (undoable && LATER[row.name]) {
          verdicts[row.name] = await undoAfterLater(
            row.name,
            result,
            userId,
            run
          )
        } else if (row.undoAssert) {
          await row.undoAssert(result)
        }
      }
      expect(
        unruled,
        "a command with a reversal and an activity row needs a later-change case in its context's undo-later.test-support.ts"
      ).toEqual([])
      const erased = Object.entries(verdicts)
        .filter(([, verdict]) => verdict === "erased")
        .map(([name]) => name)
        .sort()
      expect(erased, "commands whose Undo erased a later change").toEqual([])
    })
  }, 120_000)

  it("job.move: a second move makes Undo of the first refuse, and undoing in reverse order works", async () => {
    await withDatabase(backend.db, async () => {
      const { id: userId, person } = await newPerson()
      const run: Run = (name, input) =>
        registry.execute({ name, input, actor: person })
      const created = await run("job.create", {
        title: "Chain",
        company: "Northwind",
      })
      const jobId = idOf(created.output)
      const first = await run("job.move", { jobId, stage: "applied" })
      const second = await run("job.move", { jobId, stage: "interview" })
      await expect(
        registry.undo(userId, first.activityId!)
      ).rejects.toMatchObject({
        code: ERROR_CODES.CONFLICT,
        message: "This card moved again, so Undo was skipped",
      })
      expect(
        await jobField(
          worldFor(userId, run),
          { output: { id: jobId } } as ExecuteResult,
          "stage"
        )
      ).toBe("interview")
      await registry.undo(userId, second.activityId!)
      await registry.undo(userId, first.activityId!)
      expect(
        await jobField(
          worldFor(userId, run),
          { output: { id: jobId } } as ExecuteResult,
          "stage"
        )
      ).toBe("saved")
    })
  }, 120_000)

  it("job.move: moving away and back to the same column still makes Undo of the first refuse", async () => {
    await withDatabase(backend.db, async () => {
      const { id: userId, person } = await newPerson()
      const run: Run = (name, input) =>
        registry.execute({ name, input, actor: person })
      const created = await run("job.create", {
        title: "Back and forth",
        company: "Northwind",
      })
      const jobId = idOf(created.output)
      const stageNow = () =>
        jobField(
          worldFor(userId, run),
          { output: { id: jobId } } as ExecuteResult,
          "stage"
        )
      const first = await run("job.move", { jobId, stage: "applied" })
      const second = await run("job.move", { jobId, stage: "interview" })
      const third = await run("job.move", { jobId, stage: "applied" })
      await expect(
        registry.undo(userId, first.activityId!)
      ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
      expect(await stageNow()).toBe("applied")
      await registry.undo(userId, third.activityId!)
      expect(await stageNow()).toBe("interview")
      await registry.undo(userId, second.activityId!)
      expect(await stageNow()).toBe("applied")
      await registry.undo(userId, first.activityId!)
      expect(await stageNow()).toBe("saved")
    })
  }, 120_000)

  it("job.move: the row an Undo writes cannot itself be undone", async () => {
    await withDatabase(backend.db, async () => {
      const { id: userId, person } = await newPerson()
      const run: Run = (name, input) =>
        registry.execute({ name, input, actor: person })
      const created = await run("job.create", {
        title: "No redo",
        company: "Northwind",
      })
      const jobId = idOf(created.output)
      const stageNow = () =>
        jobField(
          worldFor(userId, run),
          { output: { id: jobId } } as ExecuteResult,
          "stage"
        )
      const move = await run("job.move", { jobId, stage: "applied" })
      await registry.undo(userId, move.activityId!)
      expect(await stageNow()).toBe("saved")
      const [undoRow] = await getDb()
        .select({ id: activity.id })
        .from(activity)
        .where(eq(activity.idempotencyKey, undoKeyFor(move.activityId!)))
      expect(undoRow).toBeDefined()
      await expect(registry.undo(userId, undoRow!.id)).rejects.toMatchObject({
        code: ERROR_CODES.CONFLICT,
        message: "An Undo cannot be undone. Make the change again instead.",
      })
      expect(await stageNow()).toBe("saved")
      const [original] = await getDb()
        .select({ undoneAt: activity.undoneAt })
        .from(activity)
        .where(eq(activity.id, move.activityId!))
      expect(original!.undoneAt).not.toBeNull()
    })
  }, 120_000)
})
