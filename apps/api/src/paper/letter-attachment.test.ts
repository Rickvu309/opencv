import { afterEach, describe, expect, it } from "vitest"

import { files, paperDocs } from "../db/schema.js"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { textDocx, textPdf } from "./import-fixtures.test.js"
import { importParsers } from "./import-parse.js"

const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const originalParsers = {
  timeoutMs: importParsers.timeoutMs,
  openPdf: importParsers.openPdf,
  pdfText: importParsers.pdfText,
  docxText: importParsers.docxText,
  onInsert: importParsers.onInsert,
}

function formFile(bytes: Buffer, name: string, type: string) {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(bytes)], name, { type }))
  return form
}

function postAttachment(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  bytes: Buffer,
  name: string,
  type: string
) {
  return app.request("/api/paper/letter-attachment", {
    method: "POST",
    headers: { Origin: testWebOrigin, Cookie: cookie },
    body: formFile(bytes, name, type),
  })
}

afterEach(() => {
  importParsers.timeoutMs = originalParsers.timeoutMs
  importParsers.openPdf = originalParsers.openPdf
  importParsers.pdfText = originalParsers.pdfText
  importParsers.docxText = originalParsers.docxText
  importParsers.onInsert = originalParsers.onInsert
})

describe("paper letter attachment extraction endpoint", () => {
  it("extracts supported text, PDF, and DOCX into transient letter context", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-letter-attachment@example.com",
    })

    const cases = [
      {
        bytes: Buffer.from("Senior product role\n\nBuild onboarding tools."),
        name: "role.txt",
        type: "text/plain",
        expectedText: "Senior product role\n\nBuild onboarding tools.",
      },
      {
        bytes: textPdf("PDF role context"),
        name: "role.pdf",
        type: "application/pdf",
        expectedText: "PDF role context",
      },
      {
        bytes: textDocx("DOCX role context"),
        name: "role.docx",
        type: WORD,
        expectedText: "DOCX role context",
      },
    ]

    for (const item of cases) {
      const response = await postAttachment(
        app,
        owner.cookie,
        item.bytes,
        item.name,
        item.type
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        data: {
          name: item.name,
          text: item.expectedText,
          truncated: false,
        },
      })
    }

    expect(await db.select().from(files)).toEqual([])
    expect(await db.select().from(paperDocs)).toEqual([])
    await client.close()
  })

  it("rejects blank and unsupported files without persisting either", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Bea",
      email: "bea-letter-attachment@example.com",
    })

    const blank = await postAttachment(
      app,
      owner.cookie,
      Buffer.from(" \n\t "),
      "blank.txt",
      "text/plain"
    )
    expect(blank.status).toBe(400)
    expect(await blank.json()).toMatchObject({
      error: {
        message:
          "No readable text found. Paste the job text or choose another file.",
      },
    })

    const unsupported = await postAttachment(
      app,
      owner.cookie,
      Buffer.from("<html><body>not an attachment</body></html>"),
      "image.png",
      "image/png"
    )
    expect(unsupported.status).toBe(400)
    expect(await unsupported.json()).toMatchObject({
      error: { message: "Upload a PDF, Word, or text file." },
    })

    expect(await db.select().from(files)).toEqual([])
    expect(await db.select().from(paperDocs)).toEqual([])
    await client.close()
  })
})
