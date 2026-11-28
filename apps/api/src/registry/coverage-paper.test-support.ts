import { parseUserId, personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { expect } from "vitest"

import { importedPaper, saveFile } from "../paper/index.js"
import {
  idOf,
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
  const paperEdit = registry
    .list()
    .commands.find((command) => command.name === "paper.edit")
  if (!paperEdit) throw new Error("Missing Paper edit command")
  let importFile = ""
  let importPaper: unknown = null
  let editDocId = ""
  async function outlineText(docId: string) {
    return JSON.stringify(
      await registry.read("paper.outline", { docId }, personActor(userId))
    )
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
        const made = await run(paperCreate.name, {
          kind: "letter",
          name: "Coverage Letter",
          lines: ["Harbor"],
        })
        editDocId = idOf(made.output)
      },
      act: async () => {
        const read = await registry.read(
          "paper.outline",
          { docId: editDocId },
          personActor(userId)
        )
        const block = firstBlockWith(read, "Harbor")
        const at = { block: block.id, offset: 6 }
        return run(paperEdit.name, {
          docId: editDocId,
          basedOn: block.revision,
          commands: [
            {
              op: "replaceText",
              range: { from: at, to: at },
              text: " light",
              expect: "",
            },
          ],
        })
      },
      assert: async (result) => {
        expect(result.reversal?.command).toBe("paper.revert")
        expect(await outlineText(editDocId)).toContain("Harbor light")
      },
      undoAssert: async (result) => {
        await undo(result)
        const words = await outlineText(editDocId)
        expect(words).toContain("Harbor")
        expect(words).not.toContain("Harbor light")
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
  ]
}

function firstBlockWith(read: unknown, words: string) {
  const page = read as { revision: number; outline: string }
  const block = (
    JSON.parse(page.outline) as { id: string; text: string }[]
  ).find((node) => node.text.includes(words))
  if (!block) throw new Error(`missing block with ${words}`)
  return { id: block.id, revision: page.revision }
}
