import { parseUserId, personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { expect } from "vitest"

import { importedPaper, saveFile } from "../paper/index.js"
import {
  idOf,
  list,
  flag,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"

export function paperCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, registry, run, undo, paperOf, gone, userId } = tools
  const paperImport = registry
    .list()
    .commands.find((command) => command.name === "paper.import")
  if (!paperImport) throw new Error("Missing Paper import command")
  const paperUpdate = registry
    .list()
    .commands.find((command) => command.name === "paper.update")
  if (!paperUpdate) throw new Error("Missing Paper update command")
  const paperRecover = registry
    .list()
    .commands.find((command) => command.name === "paper.recover")
  if (!paperRecover) throw new Error("Missing Paper recover command")
  const paperDelete = registry
    .list()
    .commands.find((command) => command.name === "paper.delete")
  if (!paperDelete) throw new Error("Missing Paper delete command")
  const paperDeleteFile = registry
    .list()
    .commands.find((command) => command.name === "paper.deleteFile")
  if (!paperDeleteFile) throw new Error("Missing Paper file delete command")
  const paperCreate = registry
    .list()
    .commands.find((command) => command.name === "paper.create")
  if (!paperCreate) throw new Error("Missing Paper create command")
  const paperDuplicate = registry
    .list()
    .commands.find((command) => command.name === "paper.duplicate")
  if (!paperDuplicate) throw new Error("Missing Paper duplicate command")
  const paperStart = registry
    .list()
    .commands.find((command) => command.name === "paper.start")
  if (!paperStart) throw new Error("Missing Paper start command")
  const paperCanvas = registry
    .list()
    .commands.find((command) => command.name === "paper.canvas")
  if (!paperCanvas) throw new Error("Missing Paper canvas command")
  const paperEdit = registry
    .list()
    .commands.find((command) => command.name === "paper.edit")
  if (!paperEdit) throw new Error("Missing Paper edit command")
  let importFile = ""
  let importPaper: unknown = null
  let mintedDocId = ""
  let mintedParagraph = ""
  let editDocId = ""
  let editRevision = ""
  let editParagraph = ""
  async function wordPage(docId: string) {
    return registry.read("paper.read", { docId }, personActor(userId))
  }
  return [
    {
      name: paperCreate.name,
      arrange: async () => {},
      act: () => run(paperCreate.name, { kind: "cv", name: "Coverage CV" }),
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
      name: paperEdit.name,
      arrange: async () => {
        const minted = await run(paperCanvas.name, {
          op: "mint",
          label: "letter",
        })
        editDocId = text(minted.output, "docId") ?? ""
        editRevision = text(minted.output, "revision") ?? ""
        editParagraph = emptyWritingParagraph(await wordPage(editDocId))
      },
      act: () =>
        run(paperEdit.name, {
          docId: editDocId,
          basedOn: editRevision,
          edits: [
            { op: "setText", handle: editParagraph, text: "Harbor light" },
          ],
        }),
      assert: async (result) => {
        expect(result.reversal?.command).toBe("paper.undoWord")
        expect(editableText(await wordPage(editDocId))).toBe("Harbor light")
      },
      undoAssert: async (result) => {
        await undo(result)
        expect(emptyWritingParagraph(await wordPage(editDocId))).toBe(
          editParagraph
        )
      },
    },
    {
      name: paperUpdate.name,
      arrange: async () => {
        const paper = await run(paperCreate.name, {
          kind: "cv",
          name: "Rename CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () =>
        run(paperUpdate.name, {
          docId: ctx.docId,
          writer: RICH_NATIVE_WRITER,
          patch: { name: "Renamed CV", isFavorite: true, status: "ready" },
        }),
      assert: async (result) => {
        expect(result.output).toMatchObject({
          id: ctx.docId,
          name: "Renamed CV",
          isFavorite: true,
          status: "ready",
        })
        const first = await paperOf(ctx.docId)
        expect(text(first, "name")).toBe("Renamed CV")
        expect(flag(first, "isFavorite")).toBe(true)
        expect(text(first, "status")).toBe("ready")
        const beforeUpdatedAt = text(first, "updatedAt")
        const unfavorite = await run(paperUpdate.name, {
          docId: ctx.docId,
          writer: RICH_NATIVE_WRITER,
          patch: { isFavorite: false },
        })
        const unmarked = await paperOf(ctx.docId)
        expect(flag(unmarked, "isFavorite")).toBe(false)
        expect(text(unmarked, "updatedAt")).toBe(beforeUpdatedAt)
        await undo(unfavorite)
        const listed = (await registry.read(
          "paper.list",
          { writer: RICH_NATIVE_WRITER },
          personActor(userId)
        )) as { id: string; isFavorite: boolean }[]
        expect(listed.find((paper) => paper.id === ctx.docId)?.isFavorite).toBe(
          true
        )
      },
      undoAssert: async (result) => {
        await undo(result)
        const restored = await paperOf(ctx.docId)
        expect(text(restored, "name")).toBe("Rename CV")
        expect(flag(restored, "isFavorite")).toBe(false)
        expect(text(restored, "status")).toBe("draft")
      },
    },
    {
      name: paperDuplicate.name,
      arrange: async () => {
        const paper = await run(paperCreate.name, {
          kind: "cv",
          name: "Coverage CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () =>
        run(paperDuplicate.name, {
          docId: ctx.docId,
          writer: RICH_NATIVE_WRITER,
        }),
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
      name: paperDelete.name,
      arrange: async () => {
        const paper = await run(paperCreate.name, {
          kind: "cv",
          name: "Delete CV",
        })
        ctx.docId = idOf(paper.output)
      },
      act: () => run(paperDelete.name, { docId: ctx.docId }),
      assert: async () => {
        await gone(paperOf(ctx.docId))
      },
    },
    {
      name: paperRecover.name,
      arrange: async () => {
        const minted = await run(paperCanvas.name, { op: "mint", label: "cv" })
        const docId = text(minted.output, "docId")
        if (!docId) throw new Error("missing minted page")
        ctx.docId = docId
        await run(paperDelete.name, { docId })
      },
      act: () => run(paperRecover.name, { docId: ctx.docId }),
      assert: async (result) => {
        expect(idOf(result.output)).toBe(ctx.docId)
        const listed = (await registry.read(
          "paper.list",
          {},
          personActor(userId)
        )) as { id: string }[]
        expect(listed.some((paper) => paper.id === ctx.docId)).toBe(true)
      },
    },
    {
      name: paperImport.name,
      arrange: async () => {
        const upload = {
          name: "cv.txt",
          mediaType: "text/plain",
          bytes: Buffer.from("hello from an imported file"),
        }
        importFile = (
          await saveFile({
            userId: parseUserId(userId),
            ...upload,
            purpose: "import",
          })
        ).id
        importPaper = (await importedPaper(upload, { owner: userId })).paper
      },
      act: () =>
        run(paperImport.name, {
          fileId: importFile,
          kind: "cv",
          name: "cv",
          paper: importPaper,
        }),
      assert: async (result) => {
        expect(text(result.output, "name")).toBe("cv")
        const docId = text(result.output, "docId")
        if (!docId) throw new Error("missing imported Paper")
        const outline = await registry.read(
          "paper.outline",
          { docId },
          personActor(userId)
        )
        expect(JSON.stringify(outline)).toContain("hello from an imported file")
      },
    },
    {
      name: paperDeleteFile.name,
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
      act: () => run(paperDeleteFile.name, { fileId: ctx.fileId }),
      assert: async () => {
        await expect(
          registry.read("file.get", { fileId: ctx.fileId }, personActor(userId))
        ).rejects.toThrow(/not found/i)
      },
    },
    {
      name: paperStart.name,
      arrange: async () => {},
      act: () => run(paperStart.name, { kind: "cv" }),
      assert: async (result) => {
        expect(text(result.output, "kind")).toBe("cv")
        expect(text(result.output, "name")).toBe("Simple CV")
        expect(result.reversal).toBeNull()
        const docId = text(result.output, "docId")
        if (!docId) throw new Error("missing started page")
        const outline = await registry.read(
          "paper.outline",
          { docId },
          personActor(userId)
        )
        expect(JSON.stringify(outline)).toContain("[Your name]")
      },
    },
    {
      name: paperCanvas.name,
      arrange: async () => {},
      act: async () => {
        const minted = await run(paperCanvas.name, {
          op: "mint",
          label: "letter",
        })
        const docId = text(minted.output, "docId")
        const revision = text(minted.output, "revision")
        if (!docId || !revision) throw new Error("missing minted page")
        const page = await registry.read(
          "paper.read",
          { docId },
          personActor(userId)
        )
        mintedDocId = docId
        mintedParagraph = emptyWritingParagraph(page)
        return run(paperCanvas.name, {
          op: "write",
          batch: {
            doc: docId,
            basedOn: revision,
            ops: [
              { op: "setText", handle: mintedParagraph, text: "Harbor light" },
            ],
          },
        })
      },
      assert: async (result) => {
        expect(text(result.output, "generation")).toBe("package")
        expect(text(result.output, "docId")).toBe(mintedDocId)
        expect(result.reversal?.command).toBe("paper.undoWord")
        const page = await registry.read(
          "paper.read",
          { docId: mintedDocId },
          personActor(userId)
        )
        expect(editableText(page)).toBe("Harbor light")
      },
      undoAssert: async (result) => {
        await undo(result)
        const page = await registry.read(
          "paper.read",
          { docId: mintedDocId },
          personActor(userId)
        )
        expect(emptyWritingParagraph(page)).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      },
    },
  ]
}

function emptyWritingParagraph(page: unknown) {
  for (const region of list(page, "regions")) {
    if (!region || typeof region !== "object") continue
    const row = region as Record<string, unknown>
    const reason = row.reason
    if (
      row.kind === "locked" &&
      reason &&
      typeof reason === "object" &&
      "code" in reason &&
      reason.code === "EMPTY_TARGET" &&
      typeof row.paragraph === "string"
    ) {
      return row.paragraph
    }
  }
  throw new Error("missing empty paragraph")
}

function editableText(page: unknown) {
  for (const region of list(page, "regions")) {
    if (!region || typeof region !== "object") continue
    const row = region as Record<string, unknown>
    if (row.kind === "editable" && typeof row.text === "string") return row.text
  }
  throw new Error("missing written text")
}
