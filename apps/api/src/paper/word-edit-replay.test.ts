import { randomUUID } from "node:crypto"

import { coachActor, type WordPage, type WordRefusal } from "@workspace/domain"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { chats, coachUsage, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { apply, open, WORD_UNDO_MOVED } from "./word/document.js"

let backend: Backend
const owner = randomUUID()
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  installRegistry()
  backend = await openBackend()
  await backend.db.insert(user).values({
    id: owner,
    name: owner,
    email: `${owner}@test.invalid`,
  })
})

afterAll(async () => {
  await backend?.close()
})

function pageOf(value: WordPage | WordRefusal): WordPage {
  if ("refused" in value) throw new Error(value.message)
  return value
}

async function head(doc: string) {
  return pageOf(await open(owner, { kind: "read", doc }))
}

async function words(doc: string) {
  return (await head(doc)).paragraphs.map((line) => line.text)
}

async function coach() {
  const chatId = randomUUID()
  const turnId = randomUUID()
  await getDb().insert(chats).values({ id: chatId, userId: owner, title: "W" })
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId: owner,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  return coachActor(owner, chatId, turnId)
}

async function blankLine() {
  const page = pageOf(
    await open(owner, { kind: "mint", name: "Letter", label: "letter" })
  )
  const line = page.paragraphs[0]
  if (!line) throw new Error("blank page has no line")
  return { page, line: line.handle }
}

async function propose(page: WordPage, line: string, text: string) {
  const proposed = await registry.execute({
    name: "paper.edit",
    input: {
      docId: page.doc,
      basedOn: page.revision,
      edits: [{ op: "setText", handle: line, text }],
    },
    actor: await coach(),
    idempotencyKey: randomUUID(),
  })
  if (!proposed.pending) throw new Error("expected a pending proposal")
  return proposed as typeof proposed & { pendingActionId: string }
}

async function typeOver(doc: string, basedOn: string, line: string) {
  const typed = await apply(owner, {
    doc,
    basedOn,
    ops: [{ op: "setText", handle: line, text: "Typed by the person" }],
  })
  if (typed.refused) throw new Error(typed.message)
  return typed.page
}

const RECEIPT_FAILS = [
  sql.raw(
    `CREATE OR REPLACE FUNCTION opencv_app.word_edit_replay_refuse() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'receipt refused by the replay'; END; $$ LANGUAGE plpgsql`
  ),
  sql.raw(
    `CREATE TRIGGER word_edit_replay_refuse BEFORE INSERT ON opencv_app.activity FOR EACH ROW EXECUTE FUNCTION opencv_app.word_edit_replay_refuse()`
  ),
]

const RECEIPT_WORKS = sql.raw(
  `DROP TRIGGER word_edit_replay_refuse ON opencv_app.activity`
)

describe("WordEdit.tla shortest paths against the real paper.edit approval", () => {
  it("ChangesOnlyAfterApproval: a Coach batch moves no head until approval, then lands once on a retry", () =>
    run(async () => {
      const { page, line } = await blankLine()
      const proposed = await propose(page, line, "Dear Ada,")
      expect((await head(page.doc)).revision).toBe(page.revision)
      expect(await words(page.doc)).toEqual([""])
      const receipt = await registry.approve(owner, proposed.pendingActionId)
      const landed = await head(page.doc)
      expect(landed.revision).not.toBe(page.revision)
      expect(await words(page.doc)).toEqual(["Dear Ada,"])
      const retried = await registry.approve(owner, proposed.pendingActionId)
      expect(retried?.id).toBe(receipt?.id)
      expect((await head(page.doc)).revision).toBe(landed.revision)
    }))

  it("StaleNeverLands: approval after the person typed is refused, keeps their words and leaves the batch pending", () =>
    run(async () => {
      const { page, line } = await blankLine()
      const proposed = await propose(page, line, "Coach words")
      const typed = await typeOver(page.doc, page.revision, line)
      await expect(
        registry.approve(owner, proposed.pendingActionId)
      ).rejects.toThrow()
      expect((await head(page.doc)).revision).toBe(typed.revision)
      expect(await words(page.doc)).toEqual(["Typed by the person"])
      const denied = await registry.deny(owner, proposed.pendingActionId)
      expect(denied.status).toBe("denied")
    }))

  it("BothOrNeither: a receipt that cannot be written leaves the head where it was", () =>
    run(async () => {
      const { page, line } = await blankLine()
      const proposed = await propose(page, line, "Dear Ada,")
      for (const statement of RECEIPT_FAILS) await getDb().execute(statement)
      try {
        await expect(
          registry.approve(owner, proposed.pendingActionId)
        ).rejects.toThrow(/insert into "opencv_app"."activity"/)
      } finally {
        await getDb().execute(RECEIPT_WORKS)
      }
      expect((await head(page.doc)).revision).toBe(page.revision)
      expect(await words(page.doc)).toEqual([""])
      const receipt = await registry.approve(owner, proposed.pendingActionId)
      expect(receipt?.id).toBeTruthy()
      expect(await words(page.doc)).toEqual(["Dear Ada,"])
    }))

  it("UndoRestoresPriorHead: Undo puts back the exact revision the batch was based on, and refuses after later typing", () =>
    run(async () => {
      const first = await blankLine()
      const proposed = await propose(first.page, first.line, "Dear Ada,")
      const receipt = await registry.approve(owner, proposed.pendingActionId)
      if (!receipt) throw new Error("approve returned no activity")
      await registry.undo(owner, receipt.id)
      expect((await head(first.page.doc)).revision).toBe(first.page.revision)
      expect(await words(first.page.doc)).toEqual([""])

      const second = await blankLine()
      const later = await propose(second.page, second.line, "Dear Ada,")
      const kept = await registry.approve(owner, later.pendingActionId)
      if (!kept) throw new Error("approve returned no activity")
      const approved = await head(second.page.doc)
      const typed = await typeOver(
        second.page.doc,
        approved.revision,
        second.line
      )
      const undone = await registry
        .undo(owner, kept.id)
        .then((value) => JSON.stringify(value))
        .catch((error: unknown) => String(error))
      expect(undone).toContain(WORD_UNDO_MOVED)
      expect((await head(second.page.doc)).revision).toBe(typed.revision)
    }))
})
