import { parseChatId, parseUserId } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getChat, insertCoachMessage } from "../coach/chat/index.js"
import { activity, paperDocUpdates } from "../db/schema.js"
import { createId } from "../platform/id.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { saveFile } from "./store.js"
import { OLD_EDITOR_UNDO_REASON, OLD_PHOTO_UNDO_REASON } from "./undo-guard.js"

const userId = "user-activity-guard"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

type Entry = { command: string; reversible: boolean; subjectId: string }

const feed = async () =>
  (await h.store.registry.read("activity.list", {}, h.store.actor)) as Entry[]

describe("the activity feed and Coach edits", () => {
  it("still reads, with the row not reversible, once the paper is deleted", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph, more." },
      ])
      const before = (await feed()).find(
        (item) => item.subjectId === docId && item.command === "paper.edit"
      )
      expect(before?.reversible).toBe(true)
      await h.run("paper.delete", { docId })
      const after = (await feed()).filter(
        (item) => item.subjectId === docId && item.command === "paper.edit"
      )
      expect(after.length).toBeGreaterThan(0)
      expect(after.every((item) => !item.reversible)).toBe(true)
    })
  })

  it("reads 30 Coach edits of one paper from stored data in one pass", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      for (let n = 0; n < 30; n += 1) {
        const editId = createId()
        await h.store.db.insert(paperDocUpdates).values({
          paperId: docId,
          seq: 2 + n,
          origin: "coach",
          editId,
          basedOn: 1 + n,
          touched: [n % 2 === 0 ? "t1" : "t2"],
          update: Buffer.from([0, 0]),
        })
        await h.store.db.insert(activity).values({
          id: createId(),
          userId,
          actor: "coach",
          command: "paper.edit",
          subjectKind: "paper",
          subjectId: docId,
          summary: `Edited ${n}`,
          reversalCommand: "paper.revertEdit",
          reversalInput: { docId, editId },
        })
      }
      const started = performance.now()
      const rows = (await feed()).filter(
        (item) => item.subjectId === docId && item.command === "paper.edit"
      )
      const took = performance.now() - started
      console.log(`activity.list with 30 Coach edits: ${took.toFixed(1)} ms`)
      expect(rows).toHaveLength(30)
      expect(rows.filter((item) => item.reversible).length).toBeGreaterThan(0)
      expect(rows.filter((item) => !item.reversible).length).toBeGreaterThan(0)
      expect(took).toBeLessThan(500)
      await h.store.db.delete(activity).where(eq(activity.userId, userId))
    })
  })

  it("refuses an old replace or restore and still undoes a Coach edit", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      const edited = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph, kept." },
      ])
      const during = await h.textOf(docId, "t1")
      const replaceId = createId()
      const restoreId = createId()
      await h.store.db.insert(activity).values([
        {
          id: replaceId,
          userId,
          actor: "coach",
          command: "paper.replace",
          subjectKind: "paper",
          subjectId: docId,
          summary: "Updated CV",
          reversalCommand: "paper.replace",
          reversalInput: { docId, contentVersion: 1, document: {} },
        },
        {
          id: restoreId,
          userId,
          actor: "coach",
          command: "paper.replace",
          subjectKind: "paper",
          subjectId: docId,
          summary: "Updated CV again",
          reversalCommand: "paper.restore",
          reversalInput: {
            docId,
            contentVersion: 1,
            document: {},
            paper: {},
          },
        },
      ])
      const rows = (await feed()).filter((item) => item.subjectId === docId)
      const replaces = rows.filter((item) => item.command === "paper.replace")
      expect(replaces).toHaveLength(2)
      expect(replaces.every((item) => !item.reversible)).toBe(true)
      expect(
        rows.find((item) => item.command === "paper.edit")?.reversible
      ).toBe(true)
      await expect(
        h.store.registry.undo(userId, replaceId)
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: OLD_EDITOR_UNDO_REASON,
      })
      await expect(
        h.store.registry.undo(userId, restoreId)
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: OLD_EDITOR_UNDO_REASON,
      })
      const photoId = createId()
      await h.store.db.insert(activity).values({
        id: photoId,
        userId,
        actor: "person",
        command: "paper.attachPhoto",
        subjectKind: "paper",
        subjectId: docId,
        summary: "Added a photo",
        reversalCommand: "paper.restore",
        reversalInput: { docId, contentVersion: 1, document: {}, paper: {} },
      })
      await expect(
        h.store.registry.undo(userId, photoId)
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: OLD_PHOTO_UNDO_REASON,
      })
      expect(await h.textOf(docId, "t1")).toBe(during)
      const opened = await h.run("chat.create", {})
      const chatId = parseChatId((opened.output as { id: string }).id)
      const receipt = (command: string) => ({
        type: "tool" as const,
        name: "paper_replace",
        summary: "Updated CV",
        ok: true,
        reversal: {
          possible: true,
          description: "Updated CV",
          command,
          input: { docId },
        },
      })
      await insertCoachMessage({
        chatId,
        userId: parseUserId(userId),
        text: "Saved.",
        status: "final",
        workedMs: 5,
        parts: [receipt("paper.replace"), receipt("paper.restore")] as never,
      })
      const read = await getChat(parseUserId(userId), chatId)
      const reversals = read.messages.flatMap((message) =>
        message.parts.map(
          (part) =>
            (
              part as {
                reversal?: { possible?: boolean; description?: string }
              }
            ).reversal
        )
      )
      expect(reversals).toEqual([
        { possible: false, description: OLD_EDITOR_UNDO_REASON },
        { possible: false, description: OLD_EDITOR_UNDO_REASON },
      ])
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
    })
  })

  it("undoes a new photo add from the person and the Coach", async () => {
    await h.inDatabase(async () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const fileFor = (name: string) =>
        saveFile({
          userId: parseUserId(userId),
          name,
          mediaType: "image/png",
          bytes: png,
          purpose: "avatar",
        })
      const opened = await h.run("chat.create", {})
      const chatId = parseChatId((opened.output as { id: string }).id)
      const { docId: personDoc } = await h.created()
      const personFile = await fileFor("person.png")
      const personAdd = await h.run("paper.attachPhoto", {
        docId: personDoc,
        fileId: personFile.id,
      })
      const personRows = (await feed()).filter(
        (item) =>
          item.subjectId === personDoc && item.command === "paper.attachPhoto"
      )
      expect(personRows).toHaveLength(1)
      expect(personRows[0]?.reversible).toBe(true)
      await h.store.registry.undo(userId, personAdd.activityId!)
      expect(JSON.stringify(await h.paperOf(personDoc))).not.toContain("file:")

      const { docId } = await h.created()
      const earlier = await fileFor("earlier.png")
      await h.run("paper.attachPhoto", { docId, fileId: earlier.id })
      const coachFile = await fileFor("coach.png")
      const coachAdd = await h.store.registry.execute({
        name: "paper.attachPhoto",
        input: { docId, fileId: coachFile.id },
        actor: await seedCoachActor(userId, chatId),
      })
      const rows = (await feed()).filter(
        (item) =>
          item.subjectId === docId && item.command === "paper.attachPhoto"
      )
      expect(rows).toHaveLength(2)
      expect(rows.every((item) => item.reversible)).toBe(true)
      const reversal = coachAdd.reversal!
      await insertCoachMessage({
        chatId,
        userId: parseUserId(userId),
        text: "Added a photo.",
        status: "final",
        workedMs: 5,
        parts: [
          {
            type: "tool",
            name: "paper_attachPhoto",
            summary: "Added a photo",
            ok: true,
            reversal: {
              possible: true,
              description: "Added a photo",
              command: reversal.command,
              input: reversal.input,
            },
          },
        ] as never,
      })
      const read = await getChat(parseUserId(userId), chatId)
      const shown = read.messages.flatMap((message) =>
        message.parts.map(
          (part) =>
            (
              part as {
                reversal?: { possible?: boolean; description?: string }
              }
            ).reversal
        )
      )
      expect(shown[0]?.possible).toBe(true)
      expect(shown[0]?.description).toBe("Added a photo")
      await h.store.registry.undo(userId, coachAdd.activityId!)
      const after = JSON.stringify(await h.paperOf(docId))
      expect(after).toContain(earlier.id)
      expect(after).not.toContain(coachFile.id)
    })
  })
})
