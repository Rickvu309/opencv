import { randomUUID } from "node:crypto"

import { parseUserId, personActor } from "@workspace/domain"
import { expect } from "vitest"

import { importedWordPage, saveFile, stageWordPackage } from "../paper/index.js"
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
  let importStage = ""
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
      name: "paper.edit",
      arrange: async () => {
        const minted = await run("paper.canvas", {
          op: "mint",
          label: "letter",
        })
        editDocId = text(minted.output, "docId") ?? ""
        editRevision = text(minted.output, "revision") ?? ""
        editParagraph = emptyWritingParagraph(await wordPage(editDocId))
      },
      act: () =>
        run("paper.edit", {
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
        expect(editableText(await wordPage(editDocId))).toBe("")
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
      name: "paper.restoreDeleted",
      arrange: async () => {
        const minted = await run("paper.canvas", { op: "mint", label: "cv" })
        const docId = text(minted.output, "docId")
        if (!docId) throw new Error("missing minted page")
        ctx.docId = docId
        await run("paper.delete", { docId })
      },
      act: () => run("paper.restoreDeleted", { docId: ctx.docId }),
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
        const page = await importedWordPage(
          {
            name: "cv.txt",
            mediaType: "text/plain",
            bytes: Buffer.from("hello from an imported file"),
          },
          { owner: userId }
        )
        importStage = (
          await stageWordPackage(
            userId,
            { requestId: randomUUID(), name: page.name, kind: "cv" },
            page.bytes
          )
        ).stageId
      },
      act: () =>
        run(paperImport.name, { generation: "package", stageId: importStage }),
      assert: async (result) => {
        expect(text(result.output, "generation")).toBe("package")
        expect(text(result.output, "name")).toBe("cv")
        expect(result.reversal).toBeNull()
        const docId = text(result.output, "docId")
        if (!docId) throw new Error("missing imported page")
        const outline = await registry.read(
          "paper.outline",
          { docId },
          personActor(userId)
        )
        expect(text(outline, "outline")).toContain(
          "hello from an imported file"
        )
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
    {
      name: "paper.start",
      arrange: async () => {},
      act: () => run("paper.start", { kind: "cv" }),
      assert: async (result) => {
        expect(text(result.output, "generation")).toBe("package")
        expect(text(result.output, "name")).toBe("Simple CV")
        expect(result.reversal).toBeNull()
        const docId = text(result.output, "docId")
        if (!docId) throw new Error("missing started page")
        const outline = await registry.read(
          "paper.outline",
          { docId },
          personActor(userId)
        )
        expect(text(outline, "outline")).toContain("[Your name]")
      },
    },
    {
      name: "paper.canvas",
      arrange: async () => {},
      act: async () => {
        const minted = await run("paper.canvas", {
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
        return run("paper.canvas", {
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
