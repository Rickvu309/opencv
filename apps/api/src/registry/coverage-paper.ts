import { blankBlockDocument, parseUserId, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { paperDocs } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import {
  idOf,
  list,
  record,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.js"

export function paperCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, db, registry, run, undo, paperOf, gone, shares, userId } = tools
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
      },
      act: () => {
        const document = blankBlockDocument()
        return run("paper.replace", {
          docId: ctx.docId,
          contentVersion: 1,
          document: {
            ...document,
            header: { ...document.header, name: "Ada Lane" },
          },
        })
      },
      assert: async () => {
        const doc = await paperOf(ctx.docId)
        expect(text(record(record(doc, "document"), "header"), "name")).toBe(
          "Ada Lane"
        )
      },
      undoAssert: async (result) => {
        await undo(result)
        const doc = await paperOf(ctx.docId)
        expect(text(record(record(doc, "document"), "header"), "name")).toBe("")
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
        expect(text(document, "photoUrl")).toBe(`file:${ctx.fileId}`)
      },
      undoAssert: async (result) => {
        await undo(result)
        const document = record(await paperOf(ctx.docId), "document")
        expect("photoUrl" in document).toBe(false)
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
