import { readFileSync } from "node:fs"
import path from "node:path"

import { parseUserId, personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER, type Document } from "@workspace/domain/paper-doc"
import { eq, sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { migrationsFolder } from "../db/paths.js"
import {
  activity,
  paperDocUpdates,
  paperDocs,
  paperShares,
  user,
} from "../db/schema.js"
import { createId } from "../platform/id.js"
import { installRegistry } from "../install.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { createMigratedTestDb } from "../test/harness.js"
import { journalTag } from "../test/migration-journal.js"
import { saveFile } from "./store.js"
import { OLD_EDITOR_UNDO_REASON } from "./undo-guard.js"

const RESET_STATEMENT = 'DELETE FROM "opencv_app"."paper_docs";'
const OTHER_TABLES = [
  "user",
  "jobs",
  "chats",
  "chat_messages",
  "files",
  "activity",
  "idempotency",
  "pending_actions",
  "paper_doc_updates",
  "paper_shares",
  "photo_refs",
]

const resetPath = path.join(
  migrationsFolder,
  `${journalTag("reset_paper_rows")}.sql`
)

function resetMigrationText() {
  return readFileSync(resetPath, "utf8")
}

type CountRow = {
  users: number
  jobs: number
  chats: number
  messages: number
  files: number
  activity: number
  idempotency: number
  pending: number
  papers: number
  updates: number
  shares: number
  paper_refs: number
  avatar_refs: number
}

type FeedRow = {
  id: string
  command: string
  subjectId: string
  reversible: boolean
  undoneAt: string | null
}

function countsOf(row: CountRow) {
  return {
    users: Number(row.users),
    jobs: Number(row.jobs),
    chats: Number(row.chats),
    messages: Number(row.messages),
    files: Number(row.files),
    activity: Number(row.activity),
    idempotency: Number(row.idempotency),
    pending: Number(row.pending),
    papers: Number(row.papers),
    updates: Number(row.updates),
    shares: Number(row.shares),
    paperRefs: Number(row.paper_refs),
    avatarRefs: Number(row.avatar_refs),
  }
}

describe("reset paper rows", () => {
  it("is one delete of paper_docs and names no other table", () => {
    const text = resetMigrationText()
    expect(text.trim()).toBe(RESET_STATEMENT)
    expect(text.includes("-->")).toBe(false)
    expect(text.toLowerCase().includes("truncate")).toBe(false)
    expect([...text.matchAll(/"([^"]+)"/g)].map((match) => match[1])).toEqual([
      "opencv_app",
      "paper_docs",
    ])
    for (const name of OTHER_TABLES) {
      expect(text.includes(`"${name}"`)).toBe(false)
    }
  })

  it("deletes paper rows and leaves the account, job, chat, file, activity and idempotency", async () => {
    const { client, db } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-reset-paper"
    const person = personActor(userId)
    try {
      await db.insert(user).values({
        id: userId,
        name: "Ada",
        email: "reset-paper@example.com",
      })
      await withDatabase(db, async () => {
        const photo = await saveFile({
          userId: parseUserId(userId),
          name: "face.png",
          mediaType: "image/png",
          bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          purpose: "avatar",
        })
        await db
          .update(user)
          .set({ image: photo.id })
          .where(eq(user.id, userId))
        const cv = await registry.execute({
          name: "paper.create",
          input: { kind: "cv", name: "CV" },
          actor: person,
        })
        const cvId = (cv.output as { id: string }).id
        const letter = await registry.execute({
          name: "paper.create",
          input: { kind: "letter", name: "Letter" },
          actor: person,
        })
        const letterId = (letter.output as { id: string }).id
        const [source] = await db
          .select({ snapshot: paperDocs.snapshot })
          .from(paperDocs)
          .where(eq(paperDocs.id, cvId))
        const page = source?.snapshot as Document
        await db
          .update(paperDocs)
          .set({
            snapshot: {
              ...page,
              content: [
                ...page.content,
                {
                  type: "image",
                  attrs: {
                    id: "photo-1",
                    fileId: photo.id,
                    widthMpt: 72000,
                    heightMpt: 72000,
                    align: "left",
                    alt: "Photo",
                  },
                },
              ],
            },
          })
          .where(eq(paperDocs.id, cvId))
        await db
          .insert(paperShares)
          .values({ id: createId(), docId: cvId, token: "reset-paper-share" })
        const createdJob = await registry.execute({
          name: "job.create",
          input: { title: "Intern", company: "Northwind" },
          actor: person,
        })
        const jobId = (createdJob.output as { id: string }).id
        await registry.execute({
          name: "job.linkPaper",
          input: { jobId, docId: cvId, kind: "cv" },
          actor: person,
        })
        await registry.execute({
          name: "job.linkPaper",
          input: { jobId, docId: letterId, kind: "letter" },
          actor: person,
        })
        const chat = await registry.execute({
          name: "chat.create",
          input: {},
          actor: person,
        })
        const chatId = (chat.output as { id: string }).id
        await registry.execute({
          name: "chat.appendMessage",
          input: { chatId, text: "Keep this note." },
          actor: person,
          idempotencyKey: "note-reset-paper",
        })
        await registry.execute({
          name: "paper.update",
          input: {
            docId: cvId,
            writer: RICH_NATIVE_WRITER,
            patch: { name: "CV kept in the receipt" },
          },
          actor: person,
          idempotencyKey: "rename-reset-paper",
        })
        const coach = await seedCoachActor(userId, chatId)
        const pending = await registry.execute({
          name: "job.move",
          input: { jobId, stage: "applied" },
          actor: coach,
        })
        expect(pending.pending).toBe(true)
        const editId = createId()
        await db.insert(paperDocUpdates).values({
          paperId: cvId,
          seq: 20,
          origin: "coach",
          editId,
          basedOn: 1,
          touched: ["t1"],
          update: Buffer.from([0, 0]),
        })
        const revertId = createId()
        await db.insert(activity).values({
          id: revertId,
          userId,
          actor: "coach",
          command: "paper.edit",
          subjectKind: "paper",
          subjectId: cvId,
          summary: "Edited the CV",
          reversalCommand: "paper.revertEdit",
          reversalInput: { docId: cvId, editId },
        })
        const createIdForUndo = cv.activityId
        if (!createIdForUndo) throw new Error("paper.create wrote no activity")

        const readCounts = async () => {
          const result = await db.execute<CountRow>(sql`
            select
              (select count(*)::int from "opencv_app"."user") as users,
              (select count(*)::int from "opencv_app"."jobs") as jobs,
              (select count(*)::int from "opencv_app"."chats") as chats,
              (select count(*)::int from "opencv_app"."chat_messages") as messages,
              (select count(*)::int from "opencv_app"."files") as files,
              (select count(*)::int from "opencv_app"."activity") as activity,
              (select count(*)::int from "opencv_app"."idempotency") as idempotency,
              (select count(*)::int from "opencv_app"."pending_actions") as pending,
              (select count(*)::int from "opencv_app"."paper_docs") as papers,
              (select count(*)::int from "opencv_app"."paper_doc_updates") as updates,
              (select count(*)::int from "opencv_app"."paper_shares") as shares,
              (select count(*)::int from "opencv_app"."photo_refs"
                where "source" like 'paper_docs.%'
                   or "source" like 'paper_doc_updates:%') as paper_refs,
              (select count(*)::int from "opencv_app"."photo_refs"
                where "source" like 'user.image:%') as avatar_refs
          `)
          return countsOf(result.rows[0]!)
        }
        const readSources = async () => {
          const result = await db.execute<{ source: string }>(sql`
            select "source" from "opencv_app"."photo_refs" order by "source"
          `)
          return result.rows.map((row) => row.source)
        }
        const readJob = async () => {
          const result = await db.execute<{
            cv_doc_id: string | null
            letter_doc_id: string | null
          }>(sql`
            select "cv_doc_id", "letter_doc_id" from "opencv_app"."jobs"
          `)
          return result.rows
        }
        const readFeed = async () =>
          (await registry.read("activity.list", {}, person)) as FeedRow[]

        const before = {
          counts: await readCounts(),
          sources: await readSources(),
          job: await readJob(),
          feed: (await readFeed())
            .filter((row) => row.subjectId === cvId)
            .map((row) => ({
              id: row.id,
              command: row.command,
              reversible: row.reversible,
            })),
        }
        expect(before.counts.papers).toBe(2)
        expect(before.counts.updates).toBeGreaterThan(0)
        expect(before.counts.shares).toBe(1)
        expect(before.counts.paperRefs).toBeGreaterThan(0)
        expect(before.counts.avatarRefs).toBe(1)
        expect(before.counts.files).toBe(1)
        expect(before.counts.messages).toBe(1)
        expect(before.counts.idempotency).toBe(1)
        expect(before.counts.pending).toBe(1)
        expect(before.job).toEqual([
          { cv_doc_id: cvId, letter_doc_id: letterId },
        ])
        expect(before.feed.find((row) => row.id === revertId)?.reversible).toBe(
          false
        )

        await client.exec(resetMigrationText())

        const after = {
          counts: await readCounts(),
          sources: await readSources(),
          job: await readJob(),
        }
        expect(after.counts.papers).toBe(0)
        expect(after.counts.updates).toBe(0)
        expect(after.counts.shares).toBe(0)
        expect(after.counts.paperRefs).toBe(0)
        expect(after.counts.avatarRefs).toBe(1)
        expect(after.job).toEqual([{ cv_doc_id: null, letter_doc_id: null }])
        const kept = {
          users: after.counts.users,
          jobs: after.counts.jobs,
          chats: after.counts.chats,
          messages: after.counts.messages,
          files: after.counts.files,
          activity: after.counts.activity,
          idempotency: after.counts.idempotency,
          pending: after.counts.pending,
        }
        expect(kept).toEqual({
          users: before.counts.users,
          jobs: before.counts.jobs,
          chats: before.counts.chats,
          messages: before.counts.messages,
          files: before.counts.files,
          activity: before.counts.activity,
          idempotency: before.counts.idempotency,
          pending: before.counts.pending,
        })

        const feed = (await readFeed()).filter(
          (row) => row.subjectId === cvId || row.subjectId === letterId
        )
        const revert = feed.find((row) => row.id === revertId)
        const created = feed.find((row) => row.id === createIdForUndo)
        expect(revert).toMatchObject({ reversible: false, undoneAt: null })
        expect(created).toMatchObject({
          command: "paper.create",
          reversible: false,
          undoneAt: null,
        })
        await expect(registry.undo(userId, revertId)).rejects.toMatchObject({
          code: "CONFLICT",
          message: OLD_EDITOR_UNDO_REASON,
        })
        await expect(
          registry.undo(userId, createIdForUndo)
        ).rejects.toMatchObject({
          code: "CONFLICT",
          message:
            "This Paper was renamed or deleted after it was made, so Undo was skipped",
        })
        const afterUndo = await readCounts()
        expect(afterUndo).toEqual(after.counts)
        expect(await readJob()).toEqual(after.job)
        const stillThere = (await readFeed()).find(
          (row) => row.id === createIdForUndo
        )
        expect(stillThere).toMatchObject({ undoneAt: null, reversible: false })
        console.log(
          JSON.stringify({
            before,
            after: { ...after, feed },
          })
        )
      })
    } finally {
      await client.close()
    }
  })
})
