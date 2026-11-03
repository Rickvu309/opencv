import {
  blankBlockDocument,
  legacyPaperOf,
  parseUserId,
  personActor,
  type PaperDocument,
} from "@workspace/domain"
import {
  absorbUpdate,
  loadYDoc,
  materialize,
  stateVectorOf,
  writeDocument,
  type PaperYDoc,
} from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { paperDocs } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import {
  bytesOf,
  clientFrom,
  encoded,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"
import {
  idOf,
  list,
  flag,
  record,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.js"

export function paperCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, db, registry, run, undo, paperOf, gone, shares, userId } = tools
  let letterId = ""
  let letterVersion = 1
  let cvReplace: Awaited<ReturnType<typeof run>> | null = null
  const letterWithParts = {
    markdown: "First.\n\nSecond.",
    sender: "Linh Nguyen",
    contact: "linh@example.com",
    date: "October 26, 2026",
    recipient: "Hiring Team\nLumiere",
    salutation: "Dear team,",
    closing: "Warm regards,",
    signature: "Linh",
  }
  let syncPush = ""
  const coachSentence = "First paragraph. Coach adds a sentence."
  async function startCoachEdit() {
    const paper = await run("paper.create", {
      kind: "cv",
      name: "Edit CV",
      document: twoParagraphCv,
    })
    ctx.docId = idOf(paper.output)
    return clientFrom(
      text(
        await run("paper.sync", {
          docId: ctx.docId,
          epoch: 0,
          update: "",
          stateVector: "",
        }).then((pulled) => pulled.output),
        "update"
      ) ?? ""
    )
  }
  let editClient: PaperYDoc | null = null
  const coachEdits = [
    { op: "setText", blockId: "t1", text: coachSentence },
    {
      op: "insert",
      after: "t2",
      blocks: [{ type: "paragraph", text: "A third paragraph." }],
    },
  ]
  async function blockText(blockId: string) {
    const row = (
      await db.select().from(paperDocs).where(eq(paperDocs.id, ctx.docId))
    )[0]!
    const stored = row.crdtDocument as unknown as PaperDocument
    const block = stored.blocks.find((candidate) => candidate.id === blockId)
    return block && "content" in block
      ? block.content.map((run) => run.text).join("")
      : null
  }
  const lettersAfter = { markdown: "Only one paragraph.", sender: "Linh" }
  return [
    {
      name: "paper.create",
      arrange: async () => {},
      act: () => run("paper.create", { kind: "cv", name: "Coverage CV" }),
      assert: async (result) => {
        expect(text(await paperOf(idOf(result.output)), "name")).toBe(
          "Coverage CV"
        )
      },
      undoAssert: async (result) => {
        const docId = idOf(result.output)
        await undo(result)
        await gone(paperOf(docId))
      },
    },
    {
      name: "paper.replace",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Replace CV",
        })
        ctx.docId = idOf(paper.output)
        const letter = await run("paper.create", {
          kind: "letter",
          name: "Replace letter",
        })
        letterId = idOf(letter.output)
        const filled = await run("paper.replace", {
          docId: letterId,
          contentVersion: 1,
          document: letterWithParts,
        })
        letterVersion = Number(
          (filled.output as { contentVersion: number }).contentVersion
        )
      },
      act: async () => {
        const document = blankBlockDocument()
        cvReplace = await run("paper.replace", {
          docId: ctx.docId,
          contentVersion: 1,
          document: {
            ...document,
            header: { ...document.header, name: "Ada Lane" },
          },
        })
        return run("paper.replace", {
          docId: letterId,
          contentVersion: letterVersion,
          document: lettersAfter,
        })
      },
      assert: async () => {
        const doc = await paperOf(ctx.docId)
        expect(text(record(record(doc, "document"), "header"), "name")).toBe(
          "Ada Lane"
        )
        expect(record(await paperOf(letterId), "document")).toEqual(
          lettersAfter
        )
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(record(await paperOf(letterId), "document")).toEqual(
          letterWithParts
        )
        if (!cvReplace) throw new Error("missing cv replace")
        await undo(cvReplace)
        const doc = await paperOf(ctx.docId)
        expect(text(record(record(doc, "document"), "header"), "name")).toBe("")
      },
    },
    {
      name: "paper.sync",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Sync CV",
        })
        ctx.docId = idOf(paper.output)
        const pulled = await run("paper.sync", {
          docId: ctx.docId,
          epoch: 0,
          update: "",
          stateVector: "",
        })
        const pulledUpdate = text(pulled.output, "update") ?? ""
        const client = loadYDoc(
          new Uint8Array(Buffer.from(pulledUpdate, "base64")),
          []
        )
        const materialized = materialize(client)
        if (!materialized.ok || materialized.document.kind !== "cv") {
          throw new Error("The pulled document did not materialize")
        }
        const typed = {
          ...materialized.document,
          header: { ...materialized.document.header, name: "Synced name" },
        }
        const update = writeDocument(client, typed, "person")
        syncPush = Buffer.from(update ?? new Uint8Array()).toString("base64")
      },
      act: () =>
        run("paper.sync", {
          docId: ctx.docId,
          epoch: 1,
          update: syncPush,
          stateVector: "",
          basedOn: 1,
        }),
      assert: async (result) => {
        expect(result.output).toMatchObject({
          epoch: 1,
          revision: 2,
          reset: false,
          stale: false,
        })
        const document = record(await paperOf(ctx.docId), "document")
        expect(record(document, "header")).toMatchObject({
          name: "Synced name",
        })
      },
    },
    {
      name: "paper.edit",
      arrange: async () => {
        editClient = await startCoachEdit()
      },
      act: () =>
        run("paper.edit", { docId: ctx.docId, basedOn: 1, edits: coachEdits }),
      assert: async (result) => {
        expect(result.output).toMatchObject({
          revision: 2,
          outcomes: [{ status: "applied" }, { status: "applied" }],
        })
        expect(await blockText("t1")).toBe(coachSentence)
        expect(result.reversal).toMatchObject({
          command: "paper.revertEdit",
          input: { docId: ctx.docId },
        })
      },
      undoAssert: async (result) => {
        if (!editClient) throw new Error("missing client")
        const pulled = await run("paper.sync", {
          docId: ctx.docId,
          epoch: 1,
          update: "",
          stateVector: encoded(stateVectorOf(editClient)),
        })
        absorbUpdate(
          editClient,
          bytesOf(text(pulled.output, "update") ?? ""),
          "log"
        )
        await run("paper.sync", {
          docId: ctx.docId,
          epoch: 1,
          update: typed(editClient, (paper) =>
            withText(paper, "t1", coachSentence.replace("adds ", "adds QUICK "))
          ),
          stateVector: "",
          basedOn: (pulled.output as { revision: number }).revision,
        })
        await undo(result)
        expect(await blockText("t1")).toBe("First paragraph.QUICK ")
        expect(await blockText("t2")).toBe("Second paragraph.")
        const stored = (
          await db.select().from(paperDocs).where(eq(paperDocs.id, ctx.docId))
        )[0]!.crdtDocument as unknown as PaperDocument
        expect(stored.blocks.map((block) => block.id)).toEqual([
          "s1",
          "t1",
          "t2",
        ])
      },
    },
    {
      name: "paper.revertEdit",
      arrange: async () => {
        await startCoachEdit()
      },
      act: async () => {
        const edited = await run("paper.edit", {
          docId: ctx.docId,
          basedOn: 1,
          edits: coachEdits,
        })
        return run("paper.revertEdit", {
          docId: ctx.docId,
          editId: text(edited.output, "editId") ?? "",
        })
      },
      assert: async (result) => {
        expect(result.output).toMatchObject({ reverted: true, revision: 3 })
        expect(await blockText("t1")).toBe("First paragraph.")
      },
    },
    {
      name: "paper.restore",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Restore CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: async () => {
        const row = (
          await db.select().from(paperDocs).where(eq(paperDocs.id, ctx.docId))
        )[0]!
        const stored = row.crdtDocument as unknown as PaperDocument
        if (stored.kind !== "cv") throw new Error("expected a CV")
        const restored = {
          ...stored,
          header: { ...stored.header, name: "Restored name" },
        }
        return run("paper.restore", {
          docId: ctx.docId,
          contentVersion: row.contentVersion,
          document: legacyPaperOf(restored, row.document),
          paper: restored,
        })
      },
      assert: async () => {
        const document = record(await paperOf(ctx.docId), "document")
        expect(record(document, "header")).toMatchObject({
          name: "Restored name",
        })
      },
      undoAssert: async (result) => {
        await undo(result)
        const document = record(await paperOf(ctx.docId), "document")
        expect(record(document, "header")).toMatchObject({ name: "" })
      },
    },
    {
      name: "paper.rename",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Rename CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () => run("paper.rename", { docId: ctx.docId, name: "Renamed CV" }),
      assert: async () => {
        expect(text(await paperOf(ctx.docId), "name")).toBe("Renamed CV")
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(text(await paperOf(ctx.docId), "name")).toBe("Rename CV")
      },
    },
    {
      name: "paper.setFavorite",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Favorite CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () =>
        run("paper.setFavorite", { docId: ctx.docId, isFavorite: true }),
      assert: async (result) => {
        expect(result.output).toEqual({ docId: ctx.docId, isFavorite: true })
        const first = await paperOf(ctx.docId)
        expect(flag(first, "isFavorite")).toBe(true)
        const beforeUpdatedAt = text(first, "updatedAt")
        const beforeVersion = (first as { contentVersion: number })
          .contentVersion
        const repeated = await run("paper.setFavorite", {
          docId: ctx.docId,
          isFavorite: true,
        })
        expect(repeated.output).toEqual(result.output)
        const after = await paperOf(ctx.docId)
        expect(flag(after, "isFavorite")).toBe(true)
        expect(text(after, "updatedAt")).toBe(beforeUpdatedAt)
        expect((after as { contentVersion: number }).contentVersion).toBe(
          beforeVersion
        )
        await run("paper.setFavorite", { docId: ctx.docId, isFavorite: false })
        expect(flag(await paperOf(ctx.docId), "isFavorite")).toBe(false)
        await run("paper.setFavorite", { docId: ctx.docId, isFavorite: true })
        const listed = (await registry.read(
          "paper.list",
          {},
          personActor(userId)
        )) as {
          id: string
          isFavorite: boolean
        }[]
        expect(listed.find((paper) => paper.id === ctx.docId)?.isFavorite).toBe(
          true
        )
      },
    },
    {
      name: "paper.duplicate",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Coverage CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () => run("paper.duplicate", { docId: ctx.docId }),
      assert: async (result) => {
        expect(text(await paperOf(idOf(result.output)), "name")).toBe(
          "Copy of Coverage CV"
        )
      },
      undoAssert: async (result) => {
        const copyId = idOf(result.output)
        await undo(result)
        await gone(paperOf(copyId))
      },
    },
    {
      name: "paper.delete",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Delete CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () => run("paper.delete", { docId: ctx.docId }),
      assert: async () => {
        await gone(paperOf(ctx.docId))
      },
    },
    {
      name: "paper.setTemplate",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Template CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () =>
        run("paper.setTemplate", { docId: ctx.docId, templateId: "modern" }),
      assert: async () => {
        expect(text(await paperOf(ctx.docId), "templateId")).toBe("modern")
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(text(await paperOf(ctx.docId), "templateId")).toBe("simple")
      },
    },
    {
      name: "paper.share",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Share CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () => run("paper.share", { docId: ctx.docId }),
      assert: async (result) => {
        const rows = await shares(ctx.docId)
        expect(rows.map((row) => row.token)).toEqual([
          text(result.output, "token"),
        ])
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(await shares(ctx.docId)).toEqual([])
      },
    },
    {
      name: "paper.unshare",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Unshare CV",
        })
        ctx.docId = idOf(paper.output)
        await run("paper.share", { docId: ctx.docId })
      },
      act: () => run("paper.unshare", { docId: ctx.docId }),
      assert: async () => {
        expect(await shares(ctx.docId)).toEqual([])
      },
    },
    {
      name: "paper.import",
      arrange: async () => {
        const file = await saveFile({
          userId: parseUserId(userId),
          name: "cv.txt",
          mediaType: "text/plain",
          bytes: Buffer.from("hello"),
          purpose: "import",
        })
        ctx.fileId = file.id
      },
      act: () => run("paper.import", { fileId: ctx.fileId }),
      assert: async (result) => {
        const doc = await paperOf(idOf(result.output))
        expect(text(doc, "kind")).toBe("cv")
        expect(text(doc, "name")).toBe("cv")
        expect(text(doc, "sourceFileId")).toBe(ctx.fileId)
      },
      undoAssert: async (result) => {
        const docId = idOf(result.output)
        await undo(result)
        await gone(paperOf(docId))
      },
    },
    {
      name: "paper.dismissCheck",
      arrange: async () => {
        const paper = await run("paper.create", { kind: "cv", name: "Checks" })
        ctx.docId = idOf(paper.output)
        await db
          .update(paperDocs)
          .set({
            checks: [
              { id: "missing", kind: "gap", message: "Add a phone number" },
            ],
          })
          .where(eq(paperDocs.id, ctx.docId))
      },
      act: () =>
        run("paper.dismissCheck", { docId: ctx.docId, checkId: "missing" }),
      assert: async () => {
        expect(list(await paperOf(ctx.docId), "checks")).toEqual([])
      },
    },
    {
      name: "paper.keepTwoPages",
      arrange: async () => {
        const paper = await run("paper.create", { kind: "cv", name: "Pages" })
        ctx.docId = idOf(paper.output)
      },
      act: () => run("paper.keepTwoPages", { docId: ctx.docId }),
      assert: async () => {
        expect(text(await paperOf(ctx.docId), "pageChoice")).toBe("keep")
      },
    },
    {
      name: "paper.setStatus",
      arrange: async () => {
        const paper = await run("paper.create", { kind: "cv", name: "Status" })
        ctx.docId = idOf(paper.output)
      },
      act: () => run("paper.setStatus", { docId: ctx.docId, status: "ready" }),
      assert: async () => {
        expect(text(await paperOf(ctx.docId), "status")).toBe("ready")
      },
    },
    {
      name: "paper.attachPhoto",
      arrange: async () => {
        const paper = await run("paper.create", {
          kind: "cv",
          name: "Photo CV",
        })
        ctx.docId = idOf(paper.output)
        const file = await saveFile({
          userId: parseUserId(userId),
          name: "face.png",
          mediaType: "image/png",
          bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          purpose: "avatar",
        })
        ctx.fileId = file.id
      },
      act: () =>
        run("paper.attachPhoto", { docId: ctx.docId, fileId: ctx.fileId }),
      assert: async () => {
        const document = record(await paperOf(ctx.docId), "document")
        expect(text(record(document, "header"), "photo")).toBe(
          `file:${ctx.fileId}`
        )
      },
      undoAssert: async (result) => {
        await undo(result)
        const document = record(await paperOf(ctx.docId), "document")
        expect("photo" in record(document, "header")).toBe(false)
      },
    },
    {
      name: "paper.deleteFile",
      arrange: async () => {
        const file = await saveFile({
          userId: parseUserId(userId),
          name: "notes.txt",
          mediaType: "text/plain",
          bytes: Buffer.from("notes"),
          purpose: "import",
        })
        ctx.fileId = file.id
      },
      act: () => run("paper.deleteFile", { fileId: ctx.fileId }),
      assert: async () => {
        await expect(
          registry.read("file.get", { fileId: ctx.fileId }, personActor(userId))
        ).rejects.toThrow(/not found/i)
      },
    },
  ]
}
