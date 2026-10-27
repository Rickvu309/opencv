import {
  IMPORT_GOOGLE_MESSAGE,
  IMPORT_PAGES_MESSAGE,
  parseUserId,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import {
  parseImportFile,
  parseImportLink,
  textDocx,
  textPdf,
} from "./import-parse.js"
import { saveFile } from "./store.js"

describe("import parse", () => {
  it("reads a one-page text PDF into a text block", async () => {
    const parsed = await parseImportFile({
      name: "import-sample.pdf",
      mediaType: "application/pdf",
      bytes: textPdf("Campus newsletter"),
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const texts = parsed.document.sections.flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.type === "text" || block.type === "heading" ? [block.text] : []
      )
    )
    expect(texts.some((text) => text.includes("Campus newsletter"))).toBe(true)
  })

  it("reads a docx paragraph", async () => {
    const parsed = await parseImportFile({
      name: "notes.docx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: textDocx("Weekly newsletter for students"),
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const texts = parsed.document.sections.flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.type === "text" || block.type === "heading" ? [block.text] : []
      )
    )
    expect(texts).toContain("Weekly newsletter for students")
  })

  it("returns the Pages sentence and writes no row", async () => {
    const { db, client } = await createMigratedTestDb()
    await withDatabase(db, async () => {
      await expect(
        saveFile({
          userId: parseUserId("user-pages"),
          name: "sample.pages",
          mediaType: "application/vnd.apple.pages",
          bytes: Buffer.from("not a pdf"),
          purpose: "import",
        })
      ).rejects.toMatchObject({ message: IMPORT_PAGES_MESSAGE })
      expect(await db.select().from(paperDocs)).toEqual([])
    })
    await client.close()
  })

  it("returns the Google sentence and writes no row", async () => {
    const { db, client } = await createMigratedTestDb()
    const result = parseImportLink("https://docs.google.com/document/d/abc")
    expect(result).toMatchObject({
      ok: false,
      code: "LINK_UNREADABLE",
      message: IMPORT_GOOGLE_MESSAGE,
    })
    await withDatabase(db, async () => {
      expect(
        await db.select().from(paperDocs).where(eq(paperDocs.kind, "cv"))
      ).toEqual([])
    })
    await client.close()
  })
})
