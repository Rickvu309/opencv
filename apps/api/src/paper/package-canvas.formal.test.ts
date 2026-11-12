import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"

import {
  PAPER_CANVAS_PROFILE,
  coachActor,
  paperPackageEditResultSchema,
  personActor,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  chats,
  coachUsage,
  files,
  paperPackageCandidates,
  paperPackageHeads,
  paperPackageVersions,
  pendingActions,
  user,
} from "../db/schema.js"
import { bindCatalog } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { commitWordCandidate } from "./package-candidates.js"
import { prepareCanvas } from "./package-canvas.js"
import { WORD_UNDO_MOVED } from "./word/document.js"
import {
  mergeInput,
  splitInput,
  writeInput,
} from "../test/word-canvas-inputs.js"
import { registerPaper } from "./commands.js"
import { implementation as readWord } from "./operations/read/server.js"
import {
  exportWordPackage,
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"

const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  mintBlankBytes: () => Uint8Array
  fillPaintedText: (bytes: Uint8Array, text: string) => Uint8Array
  packageFromBody: (body: string) => Uint8Array
  paragraphsOf: (bytes: Uint8Array) => unknown[]
  wordIds: (paragraph: unknown) => {
    paraId: string | null
    textId: string | null
  }
  emptyTextNode: (paragraph: unknown) => boolean
  isCarrier: (paragraph: unknown) => boolean
  sectCount: (bytes: Uint8Array) => number
  runsOf: (paragraph: unknown) => { text: string; rPr: string }[]
}
const marks = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-checks.mjs"
) as {
  FIRST: string
  PPR: string
  NUM: string
  MARK: string
  H1: string
  ID_B: string
  TID_B: string
  writing: (
    text: string,
    pPr?: string,
    paraId?: string,
    textId?: string
  ) => string
  carrier: () => string
}

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)
const enabled = process.env.PAPER_PACKAGE_ENABLED

beforeAll(async () => {
  process.env.PAPER_PACKAGE_ENABLED = "true"
  backend = await openBackend()
})
afterAll(async () => {
  if (enabled === undefined) delete process.env.PAPER_PACKAGE_ENABLED
  else process.env.PAPER_PACKAGE_ENABLED = enabled
  await backend?.close()
})

function registry() {
  const value = new Registry()
  registerPaper(value)
  bindCatalog(value, { "paper.read": readWord })
  return value
}

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

async function headOf(docId: string) {
  const [head] = await getDb()
    .select()
    .from(paperPackageHeads)
    .where(eq(paperPackageHeads.docId, docId))
  if (!head) throw new Error("Missing head")
  return head
}

async function sidecarOf(owner: string, revision: string) {
  const [row] = await getDb()
    .select({ sidecar: paperPackageVersions.sidecar })
    .from(paperPackageVersions)
    .where(
      and(
        eq(paperPackageVersions.userId, owner),
        eq(paperPackageVersions.revision, revision)
      )
    )
  if (!row) throw new Error("Missing sidecar")
  return row.sidecar as {
    paragraphs: { key: string; textIds: string[] }[]
  }
}

async function counts(owner: string) {
  const versions = await getDb()
    .select({ revision: paperPackageVersions.revision })
    .from(paperPackageVersions)
    .where(eq(paperPackageVersions.userId, owner))
  const candidates = await getDb()
    .select({ id: paperPackageCandidates.id })
    .from(paperPackageCandidates)
    .where(eq(paperPackageCandidates.userId, owner))
  const stored = await getDb()
    .select({ id: files.id })
    .from(files)
    .where(eq(files.userId, owner))
  return {
    versions: versions.length,
    candidates: candidates.length,
    files: stored.length,
  }
}

async function markMinted(docId: string) {
  await getDb()
    .update(paperPackageHeads)
    .set({ canvasProfile: PAPER_CANVAS_PROFILE })
    .where(eq(paperPackageHeads.docId, docId))
}

async function publishBytes(owner: string, bytes: Uint8Array) {
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "Page.docx", kind: "letter" },
    bytes
  )
  const published = await publishWordPackage(owner, stage.stageId)
  return {
    ...published,
    incarnation: (await headOf(published.docId)).incarnation,
  }
}

async function canvas(owner: string, input: unknown, key = randomUUID()) {
  const result = await registry().execute({
    name: "paper.canvas",
    input,
    actor: personActor(owner),
    idempotencyKey: key,
  })
  return {
    ...paperPackageEditResultSchema.parse(result.output),
    activityId: result.activityId,
  }
}

function paragraphs(bytes: Uint8Array) {
  return loaded.paragraphsOf(bytes)
}

async function exported(owner: string, docId: string, revision: string) {
  return (await exportWordPackage(owner, docId, revision)).bytes
}

describe("a blank page saves through the existing check", () => {
  it("mints one empty line and a section mark, then splits, merges, and deletes", () =>
    run(async () => {
      const id = await seed()
      const minted = await canvas(id, { op: "mint" })
      const again = await canvas(id, { op: "mint" })
      expect(again.docId).not.toBe(minted.docId)
      const bytes = await exported(id, minted.docId, minted.revision)
      const body = paragraphs(bytes)
      expect(body).toHaveLength(2)
      expect(loaded.sectCount(bytes)).toBe(1)
      expect(loaded.wordIds(body[0])).toEqual({
        paraId: "11111111",
        textId: "11111112",
      })
      expect(loaded.emptyTextNode(body[0])).toBe(true)
      expect(loaded.isCarrier(body[0])).toBe(false)
      expect(loaded.wordIds(body[1])).toEqual({
        paraId: "22222221",
        textId: "22222222",
      })
      expect(loaded.isCarrier(body[1])).toBe(true)
      const side = await sidecarOf(id, minted.revision)
      const carrierKey = side.paragraphs[1]!.key
      const beforeIds = side.paragraphs[0]!.textIds.length
      const splitKey = randomUUID()
      const split = await canvas(
        id,
        await splitInput(
          id,
          minted.docId,
          minted.revision,
          side.paragraphs[0]!.key,
          0
        ),
        splitKey
      )
      const savedRows = await counts(id)
      const replay = await canvas(
        id,
        await splitInput(
          id,
          minted.docId,
          minted.revision,
          side.paragraphs[0]!.key,
          0
        ),
        splitKey
      )
      expect(replay.revision).toBe(split.revision)
      expect(await counts(id)).toEqual(savedRows)
      const splitBytes = await exported(id, split.docId, split.revision)
      const splitBody = paragraphs(splitBytes)
      expect(splitBody).toHaveLength(3)
      expect(loaded.wordIds(splitBody[0])).toEqual({
        paraId: "11111111",
        textId: "11111112",
      })
      expect(loaded.wordIds(splitBody[1])).toEqual({
        paraId: null,
        textId: null,
      })
      expect(loaded.emptyTextNode(splitBody[0])).toBe(true)
      expect(loaded.emptyTextNode(splitBody[1])).toBe(true)
      expect(loaded.isCarrier(splitBody[2])).toBe(true)
      expect(loaded.sectCount(splitBytes)).toBe(1)
      const splitSide = await sidecarOf(id, split.revision)
      expect(splitSide.paragraphs[2]!.key).toBe(carrierKey)
      expect(splitSide.paragraphs[0]!.key).toBe(side.paragraphs[0]!.key)
      expect(splitSide.paragraphs[1]!.textIds).toEqual([])
      expect(splitSide.paragraphs[0]!.textIds).toHaveLength(beforeIds)
      const [saved] = await getDb()
        .select({ seal: paperPackageCandidates.seal })
        .from(paperPackageCandidates)
        .where(eq(paperPackageCandidates.forwardRevision, split.revision))
      expect((saved?.seal as { profile: string }).profile).toBe(
        PAPER_CANVAS_PROFILE
      )
      const removed = await canvas(
        id,
        writeInput(split.docId, split.revision, [
          { op: "delete", handle: splitSide.paragraphs[1]!.key },
        ])
      )
      const removedBytes = await exported(id, removed.docId, removed.revision)
      const removedBody = paragraphs(removedBytes)
      expect(removedBody).toHaveLength(2)
      expect(loaded.wordIds(removedBody[0])).toEqual({
        paraId: "11111111",
        textId: "11111112",
      })
      expect(loaded.isCarrier(removedBody[1])).toBe(true)
      const removedSide = await sidecarOf(id, removed.revision)
      expect(removedSide.paragraphs[0]!.key).toBe(splitSide.paragraphs[0]!.key)
      expect(removedSide.paragraphs[1]!.key).toBe(carrierKey)
      const only = await canvas(id, { op: "mint" })
      const onlySide = await sidecarOf(id, only.revision)
      await expect(
        canvas(
          id,
          writeInput(only.docId, only.revision, [
            { op: "delete", handle: onlySide.paragraphs[0]!.key },
          ])
        )
      ).rejects.toThrow(
        "Paper will not remove the last line of the page. Clear its words instead. No document was changed."
      )
      expect((await headOf(only.docId)).revision).toBe(only.revision)
      const typed = await publishBytes(
        id,
        loaded.fillPaintedText(loaded.mintBlankBytes(), marks.FIRST)
      )
      await markMinted(typed.docId)
      const typedSide = await sidecarOf(id, typed.revision)
      const typedSplit = await canvas(
        id,
        await splitInput(
          id,
          typed.docId,
          typed.revision,
          typedSide.paragraphs[0]!.key,
          1
        )
      )
      const typedSplitSide = await sidecarOf(id, typedSplit.revision)
      const merged = await canvas(
        id,
        await mergeInput(
          id,
          typed.docId,
          typedSplit.revision,
          typedSplitSide.paragraphs[1]!.key
        )
      )
      const mergedBody = paragraphs(
        await exported(id, merged.docId, merged.revision)
      )
      const runs = loaded.runsOf(mergedBody[0])
      expect(runs).toHaveLength(2)
      expect(runs[0]!.rPr).toBe(runs[1]!.rPr)
      expect(runs[0]!.rPr).toContain("231F20")
      expect(loaded.wordIds(mergedBody[0])).toEqual({
        paraId: "11111111",
        textId: "11111112",
      })
      expect(loaded.isCarrier(mergedBody[1])).toBe(true)
    }))

  it("refuses numbering and a paragraph mark", () =>
    run(async () => {
      const id = await seed()
      const packages = [
        loaded.packageFromBody(
          marks.writing("Hello", `${marks.PPR}${marks.NUM}`) +
            marks.writing(
              "Next",
              `${marks.PPR}${marks.NUM}`,
              marks.ID_B,
              marks.TID_B
            ) +
            marks.carrier()
        ),
        loaded.packageFromBody(
          marks.writing("Hello", `${marks.PPR}${marks.MARK}`) + marks.carrier()
        ),
      ]
      for (const bytes of packages) {
        const doc = await publishBytes(id, bytes)
        const side = await sidecarOf(id, doc.revision)
        await expect(
          canvas(
            id,
            await splitInput(
              id,
              doc.docId,
              doc.revision,
              side.paragraphs[0]!.key,
              1
            )
          )
        ).rejects.toThrow(
          /This paragraph (is numbered|has a change mark)\. Paper/
        )
        expect((await headOf(doc.docId)).revision).toBe(doc.revision)
        expect(await exported(id, doc.docId, doc.revision)).toEqual(
          Buffer.from(bytes)
        )
      }
    }))

  it("keeps the later page when an earlier save is undone", () =>
    run(async () => {
      const id = await seed()
      const minted = await canvas(id, { op: "mint" })
      const side = await sidecarOf(id, minted.revision)
      const split = await canvas(
        id,
        await splitInput(
          id,
          minted.docId,
          minted.revision,
          side.paragraphs[0]!.key,
          0
        )
      )
      const splitSide = await sidecarOf(id, split.revision)
      const removed = await canvas(
        id,
        writeInput(split.docId, split.revision, [
          { op: "delete", handle: splitSide.paragraphs[1]!.key },
        ])
      )
      const before = await counts(id)
      const bytes = await exported(id, removed.docId, removed.revision)
      await expect(registry().undo(id, split.activityId!)).rejects.toThrow(
        WORD_UNDO_MOVED
      )
      expect((await headOf(removed.docId)).revision).toBe(removed.revision)
      expect(await counts(id)).toEqual(before)
      expect(await exported(id, removed.docId, removed.revision)).toEqual(bytes)
      const [row] = await getDb()
        .select({ undoneAt: activity.undoneAt })
        .from(activity)
        .where(eq(activity.id, split.activityId!))
      expect(row?.undoneAt).toBeNull()
    }))

  it("refuses a structural save that was prepared before the page moved", () =>
    run(async () => {
      const id = await seed()
      const minted = await canvas(id, { op: "mint" })
      const side = await sidecarOf(id, minted.revision)
      const input = await splitInput(
        id,
        minted.docId,
        minted.revision,
        side.paragraphs[0]!.key,
        0
      )
      const prepared = await prepareCanvas(id, input)
      const split = await canvas(id, input)
      const before = await counts(id)
      const bytes = await exported(id, split.docId, split.revision)
      await expect(
        transaction(() =>
          commitWordCandidate(id, input, {
            candidate: prepared.candidate,
            review: prepared.review,
          })
        )
      ).rejects.toThrow(
        "This saved Word edit is no longer available. No document was changed."
      )
      expect(await counts(id)).toEqual(before)
      expect((await headOf(split.docId)).revision).toBe(split.revision)
      expect(await exported(id, split.docId, split.revision)).toEqual(bytes)
    }))

  it("drops a second save that still names the old page", () =>
    run(async () => {
      const id = await seed()
      const minted = await canvas(id, { op: "mint" })
      const side = await sidecarOf(id, minted.revision)
      const input = await splitInput(
        id,
        minted.docId,
        minted.revision,
        side.paragraphs[0]!.key,
        0
      )
      const split = await canvas(id, input)
      const bytes = await exported(id, split.docId, split.revision)
      await expect(canvas(id, input)).rejects.toThrow(
        "This Word document has changed. Read it again before editing."
      )
      expect((await headOf(split.docId)).revision).toBe(split.revision)
      expect(await exported(id, split.docId, split.revision)).toEqual(bytes)
    }))

  it("approves a frozen word replace for zero rows after the page splits", () =>
    run(async () => {
      const id = await seed()
      const chatId = randomUUID()
      const turnId = randomUUID()
      await getDb()
        .insert(chats)
        .values({ id: chatId, userId: id, title: "Review" })
      await getDb().insert(coachUsage).values({
        id: turnId,
        userId: id,
        chatId,
        plan: "free",
        mode: "free",
        provider: "fake",
        model: "fake",
      })
      const doc = await publishBytes(
        id,
        loaded.fillPaintedText(loaded.mintBlankBytes(), marks.FIRST)
      )
      await markMinted(doc.docId)
      const page = await readWordPackage(id, { docId: doc.docId })
      const target = page.regions.find((region) => region.kind === "editable")
      if (!target || target.kind !== "editable")
        throw new Error("Missing target")
      const proposed = await registry().execute({
        name: "paper.edit",
        input: {
          docId: doc.docId,
          basedOn: doc.revision,
          edits: [
            {
              op: "replaceText",
              targetId: target.targetId,
              before: "X",
              after: "Y",
            },
          ],
        },
        actor: coachActor(id, chatId, turnId),
        idempotencyKey: randomUUID(),
      })
      expect(proposed.pending).toBe(true)
      const [pending] = await getDb()
        .select()
        .from(pendingActions)
        .where(eq(pendingActions.userId, id))
      const side = await sidecarOf(id, doc.revision)
      const split = await canvas(
        id,
        await splitInput(
          id,
          doc.docId,
          doc.revision,
          side.paragraphs[0]!.key,
          1
        )
      )
      const before = await counts(id)
      const bytes = await exported(id, split.docId, split.revision)
      await expect(registry().approve(id, pending!.id)).rejects.toThrow(
        "Basis conflict"
      )
      expect(await counts(id)).toEqual(before)
      const [row] = await getDb()
        .select({ status: pendingActions.status })
        .from(pendingActions)
        .where(eq(pendingActions.id, pending!.id))
      expect(row?.status).toBe("pending")
      expect(await exported(id, split.docId, split.revision)).toEqual(bytes)
      expect(
        Buffer.from(bytes).equals(
          Buffer.from(await exported(id, doc.docId, doc.revision))
        )
      ).toBe(false)
    }))

  it("refuses the Coach and a word replace that tries to insert a break", () =>
    run(async () => {
      const id = await seed()
      const chatId = randomUUID()
      const turnId = randomUUID()
      await getDb()
        .insert(chats)
        .values({ id: chatId, userId: id, title: "Review" })
      await getDb().insert(coachUsage).values({
        id: turnId,
        userId: id,
        chatId,
        plan: "free",
        mode: "free",
        provider: "fake",
        model: "fake",
      })
      await expect(
        registry().execute({
          name: "paper.canvas",
          input: { op: "mint" },
          actor: coachActor(id, chatId, turnId),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow("The Coach cannot do this")
      expect(await counts(id)).toEqual({ versions: 0, candidates: 0, files: 0 })
      const doc = await publishBytes(
        id,
        loaded.fillPaintedText(loaded.mintBlankBytes(), marks.FIRST)
      )
      const page = await readWordPackage(id, { docId: doc.docId })
      const target = page.regions.find((region) => region.kind === "editable")
      if (!target || target.kind !== "editable")
        throw new Error("Missing target")
      await expect(
        registry().execute({
          name: "paper.edit",
          input: {
            docId: doc.docId,
            basedOn: doc.revision,
            edits: [
              {
                op: "replaceText",
                targetId: target.targetId,
                before: "",
                after: "Hello",
              },
            ],
          },
          actor: personActor(id),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow()
      await expect(
        registry().execute({
          name: "paper.edit",
          input: {
            docId: doc.docId,
            basedOn: doc.revision,
            edits: [
              {
                op: "replaceText",
                targetId: target.targetId,
                before: "X",
                after: "X\n",
              },
            ],
          },
          actor: personActor(id),
          idempotencyKey: randomUUID(),
        })
      ).rejects.toThrow("line breaks")
      expect((await headOf(doc.docId)).revision).toBe(doc.revision)
    }))
})
