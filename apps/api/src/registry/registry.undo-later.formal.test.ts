import { ERROR_CODES, parseUserId, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { activity, inboxThreads, jobChecklist, user } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import {
  backend,
  newPerson,
  registerBackendHooks,
  registry,
} from "../test/registry-formal-support.js"
import {
  flag,
  idOf,
  list,
  record,
  text,
} from "./coverage-helpers.test-support.js"
import { coverageCases } from "./coverage-setup.test-support.js"
import { undoKeyFor } from "./expectation.js"
import { REVERSAL_EXPECT_PENDING } from "./expect-pending.js"
import type { ExecuteResult } from "./registry.js"

registerBackendHooks()

type Run = (name: string, input: unknown) => Promise<ExecuteResult>

type Later = {
  act: (a: ExecuteResult, run: Run, userId: string) => Promise<void>
  survives: (a: ExecuteResult, userId: string) => Promise<boolean>
}

function outputOf(a: ExecuteResult) {
  return (a.output ?? {}) as Record<string, unknown>
}

function reversalInputOf(a: ExecuteResult) {
  return (a.reversal?.input ?? {}) as Record<string, unknown>
}

async function jobField(userId: string, a: ExecuteResult, field: string) {
  const job = await registry.read(
    "job.get",
    { jobId: idOf(a.output) },
    { type: "person", userId: parseUserId(userId) }
  )
  return text(job, field)
}

async function paperName(userId: string, a: ExecuteResult) {
  const paper = await registry.read(
    "paper.get",
    { docId: idOf(a.output) },
    { type: "person", userId: parseUserId(userId) }
  )
  return text(paper, "name")
}

async function threadStatus(a: ExecuteResult) {
  const threadId = idOf(a.output)
  const [row] = await backend.db
    .select({ status: inboxThreads.status })
    .from(inboxThreads)
    .where(eq(inboxThreads.id, threadId))
  return row?.status
}

async function chatField(userId: string, a: ExecuteResult, field: string) {
  const chat = await registry.read(
    "chat.get",
    { chatId: idOf(a.output) },
    { type: "person", userId: parseUserId(userId) }
  )
  return text(chat, field)
}

async function reversalJob(userId: string, a: ExecuteResult) {
  return registry.read(
    "job.get",
    { jobId: String(reversalInputOf(a).jobId ?? idOf(a.output)) },
    { type: "person", userId: parseUserId(userId) }
  )
}

async function checklistDone(itemId: string) {
  const [row] = await backend.db
    .select({ done: jobChecklist.done })
    .from(jobChecklist)
    .where(eq(jobChecklist.id, itemId))
  return row?.done
}

async function newCvId(run: Run, name: string) {
  return idOf((await run("paper.create", { kind: "cv", name })).output)
}

const LATER: Record<string, Later> = {
  "job.create": {
    act: async (a, run) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { location: "Osaka" },
      })
    },
    survives: async (a, userId) =>
      (await jobField(userId, a, "location").catch(() => "gone")) === "Osaka",
  },
  "job.update": {
    act: async (a, run) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { location: "Osaka" },
      })
    },
    survives: async (a, userId) =>
      (await jobField(userId, a, "location")) === "Osaka",
  },
  "job.setPriority": {
    act: async (a, run) => {
      await run("job.update", {
        jobId: idOf(a.output),
        patch: { priority: "low" },
      })
    },
    survives: async (a, userId) =>
      (await jobField(userId, a, "priority")) === "low",
  },
  "job.move": {
    act: async (a, run) => {
      await run("job.move", { jobId: idOf(a.output), stage: "interview" })
    },
    survives: async (a, userId) =>
      (await jobField(userId, a, "stage")) === "interview",
  },
  "inbox.markDone": {
    act: async (a, run) => {
      await run("inbox.snooze", {
        threadId: idOf(a.output),
        until: "2026-10-30T00:00:00.000Z",
      })
    },
    survives: async (a) => (await threadStatus(a)) === "snoozed",
  },
  "inbox.snooze": {
    act: async (a, run) => {
      await run("inbox.markDone", { threadId: idOf(a.output) })
    },
    survives: async (a) => (await threadStatus(a)) === "done",
  },
  "paper.create": {
    act: async (a, run) => {
      await run("paper.rename", { docId: idOf(a.output), name: "Renamed" })
    },
    survives: async (a, userId) =>
      (await paperName(userId, a).catch(() => "gone")) === "Renamed",
  },
  "paper.duplicate": {
    act: async (a, run) => {
      await run("paper.rename", { docId: idOf(a.output), name: "Renamed" })
    },
    survives: async (a, userId) =>
      (await paperName(userId, a).catch(() => "gone")) === "Renamed",
  },
  "paper.canvas": {
    act: async (a, run, userId) => {
      const docId = text(a.output, "docId")
      const basedOn = text(a.output, "revision")
      if (!docId || !basedOn) throw new Error("missing page")
      const page = await registry.read(
        "paper.read",
        { docId },
        personActor(userId)
      )
      const handle = writtenParagraph(page)
      await run("paper.canvas", {
        op: "write",
        batch: {
          doc: docId,
          basedOn,
          ops: [
            { op: "setText", handle, text: "Harbor" },
            { op: "insert", after: handle, text: " light" },
          ],
        },
      })
    },
    survives: async (a, userId) => {
      const docId = text(a.output, "docId")
      if (!docId) return false
      const page = await registry.read(
        "paper.read",
        { docId },
        personActor(userId)
      )
      const words = pageWords(page)
      return (
        words.includes("Harbor") &&
        words.includes("light") &&
        text(page, "revision") !== text(a.output, "revision")
      )
    },
  },
  "paper.attachPhoto": {
    act: async (a, run, userId) => {
      const second = await saveFile({
        userId: parseUserId(userId),
        name: "second.png",
        mediaType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        purpose: "avatar",
      })
      await run("paper.attachPhoto", {
        docId: idOf(a.output),
        fileId: second.id,
      })
    },
    survives: async (a, userId) => {
      const paper = await registry.read(
        "paper.get",
        { docId: idOf(a.output) },
        { type: "person", userId: parseUserId(userId) }
      )
      const header = record(record(paper, "paper"), "header")
      return (
        typeof header.photo === "string" && header.photo.startsWith("file:")
      )
    },
  },
  "chat.rename": {
    act: async (a, run) => {
      await run("chat.rename", {
        chatId: idOf(a.output),
        title: "Later title",
      })
    },
    survives: async (a, userId) =>
      (await chatField(userId, a, "title")) === "Later title",
  },
  "chat.setFocus": {
    act: async (a, run) => {
      const docId = await newCvId(run, "Later focus")
      await run("chat.setFocus", {
        chatId: idOf(a.output),
        focus: { kind: "paper", id: docId },
      })
      laterIds.focusId = docId
    },
    survives: async (a, userId) =>
      (await chatField(userId, a, "focusId")) === laterIds.focusId,
  },
  "job.star": {
    act: async (a, run) => {
      await run("job.star", { jobId: idOf(a.output), starred: false })
    },
    survives: async (a, userId) =>
      !flag(await reversalJob(userId, a), "starred"),
  },
  "job.addChecklistItem": {
    act: async (a, run) => {
      await run("job.setChecklistItem", {
        jobId: outputOf(a).jobId,
        itemId: outputOf(a).id,
        done: true,
      })
    },
    survives: async (a) =>
      (await checklistDone(String(outputOf(a).id))) === true,
  },
  "job.setChecklistItem": {
    act: async (a, run) => {
      await run("job.setChecklistItem", {
        jobId: outputOf(a).jobId,
        itemId: outputOf(a).id,
        done: false,
      })
    },
    survives: async (a) =>
      (await checklistDone(String(outputOf(a).id))) === false,
  },
  "job.linkPaper": {
    act: async (a, run) => {
      const docId = await newCvId(run, "Later CV")
      await run("job.linkPaper", {
        jobId: idOf(a.output),
        docId,
        kind: "cv",
      })
      laterIds.docId = docId
    },
    survives: async (a, userId) =>
      text(await reversalJob(userId, a), "cvDocId") === laterIds.docId,
  },
}

function writtenParagraph(page: unknown) {
  for (const region of list(page, "regions")) {
    if (!region || typeof region !== "object") continue
    const row = region as Record<string, unknown>
    if (
      row.kind === "editable" &&
      row.text === "Harbor light" &&
      typeof row.paragraph === "string"
    ) {
      return row.paragraph
    }
  }
  throw new Error("missing written paragraph")
}

function pageWords(page: unknown) {
  return list(page, "regions")
    .map((region) => {
      if (!region || typeof region !== "object") return ""
      const row = region as Record<string, unknown>
      return typeof row.text === "string" ? row.text : ""
    })
    .join("\n")
}

const laterIds: { focusId?: string; docId?: string } = {}

const OWN_UNDO_GUARD = ["paper.edit"]

const KNOWN_VIOLATIONS = ["paper.create", "paper.duplicate"]

type Verdict = "refused" | "kept" | "erased"

async function undoAfterLater(
  name: string,
  a: ExecuteResult,
  userId: string,
  run: Run
): Promise<Verdict> {
  const later = LATER[name]!
  await later.act(a, run, userId)
  try {
    await registry.undo(userId, a.activityId!)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === ERROR_CODES.CONFLICT) return "refused"
    throw error
  }
  return (await later.survives(a, userId)) ? "kept" : "erased"
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
        "a command with a reversal and an activity row needs a rule in LATER"
      ).toEqual([])
      const erased = Object.entries(verdicts)
        .filter(([, verdict]) => verdict === "erased")
        .map(([name]) => name)
        .sort()
      expect(erased, "commands whose Undo erased a later change").toEqual(
        [...KNOWN_VIOLATIONS].sort()
      )
      for (const name of KNOWN_VIOLATIONS) {
        expect(REVERSAL_EXPECT_PENDING.commands as readonly string[]).toContain(
          name
        )
      }
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
          userId,
          { output: { id: jobId } } as ExecuteResult,
          "stage"
        )
      ).toBe("interview")
      await registry.undo(userId, second.activityId!)
      await registry.undo(userId, first.activityId!)
      expect(
        await jobField(
          userId,
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
        jobField(userId, { output: { id: jobId } } as ExecuteResult, "stage")
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
        jobField(userId, { output: { id: jobId } } as ExecuteResult, "stage")
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
