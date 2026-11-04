import {
  IMPORT_GOOGLE_MESSAGE,
  IMPORT_LINKEDIN_MESSAGE,
  IMPORT_PAGES_MESSAGE,
  IMPORT_PHONE_MESSAGE,
  emptyCvDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { files, paperDocs } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { textDocx, textPdf } from "./import-fixtures.test.js"
import {
  IMPORT_FAILED_MESSAGE,
  IMPORT_GENERIC_MESSAGE,
} from "./import-parse.js"
import { IMPORT_SIZE_MESSAGE } from "./store.js"

const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type PaperBlock = {
  id?: string
  type: string
  kind?: string
  role?: string
  company?: string
  period?: string
  content?: { text?: string }[]
}

type Paper = {
  version: number
  kind: string
  header: { name: string }
  blocks: PaperBlock[]
}

type Stored = {
  paper: Paper
  checks: {
    id: string
    kind: string
    message: string
    blockId?: string
    resolved?: boolean
  }[]
  sourceFileId: string | null
  name: string
}

function summaryParagraphs(paper: Paper) {
  const start = paper.blocks.findIndex(
    (block) => block.type === "section" && block.kind === "summary"
  )
  if (start < 0) return []
  const texts: string[] = []
  for (const block of paper.blocks.slice(start + 1)) {
    if (block.type === "section") break
    if (block.type !== "paragraph") continue
    texts.push((block.content ?? []).map((run) => run.text ?? "").join(""))
  }
  return texts
}

function formFile(bytes: Buffer, name: string, type: string) {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(bytes)], name, { type }))
  return form
}

async function postFile(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  bytes: Buffer,
  name: string,
  type: string
) {
  return app.request("/api/paper/import", {
    method: "POST",
    headers: { Origin: testWebOrigin, Cookie: cookie },
    body: formFile(bytes, name, type),
  })
}

describe("paper import", () => {
  it("reads a PDF, a DOCX, text, and JSON into versioned documents with checks", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ada",
      email: "ada-import@example.com",
    })

    const pdf = await postFile(
      app,
      owner.cookie,
      textPdf("Campus newsletter"),
      "sample.pdf",
      "application/pdf"
    )
    expect(pdf.status).toBe(200)
    const pdfBody = (await pdf.json()) as { data: Stored }
    const pdfText = JSON.stringify(pdfBody.data.paper)
    expect(pdfBody.data.paper).toMatchObject({ version: 3, kind: "cv" })
    expect(pdfText).toContain("Campus newsletter")
    expect(pdfBody.data.name).toBe("sample")
    expect(pdfBody.data.sourceFileId).toEqual(expect.any(String))
    expect(pdfBody.data.checks).toContainEqual({
      id: "source-file",
      kind: "source",
      message: "sample.pdf",
      blockId: "",
      resolved: true,
    })
    expect(pdfBody.data.checks).toContainEqual({
      id: "phone",
      kind: "phone",
      message: IMPORT_PHONE_MESSAGE,
      blockId: "header.phone",
      resolved: false,
    })

    const docx = await postFile(
      app,
      owner.cookie,
      textDocx("Weekly newsletter for students"),
      "notes.docx",
      WORD
    )
    expect(docx.status).toBe(200)
    const docxBody = (await docx.json()) as { data: Stored }
    expect(JSON.stringify(docxBody.data.paper)).toContain(
      "Weekly newsletter for students"
    )
    expect(docxBody.data.paper).toMatchObject({ version: 3, kind: "cv" })

    const text = await postFile(
      app,
      owner.cookie,
      Buffer.from("First paragraph\n\nSecond paragraph"),
      "notes.txt",
      "text/plain"
    )
    expect(text.status).toBe(200)
    const textBody = (await text.json()) as { data: Stored }
    expect(summaryParagraphs(textBody.data.paper)).toEqual([
      "First paragraph",
      "Second paragraph",
    ])

    const v1 = { ...emptyCvDocument(), name: "Lan", summary: "Campus app" }
    const jsonV1 = await postFile(
      app,
      owner.cookie,
      Buffer.from(JSON.stringify(v1)),
      "lan.json",
      "application/json"
    )
    expect(jsonV1.status).toBe(200)
    const v1Body = (await jsonV1.json()) as { data: Stored }
    expect(v1Body.data.paper.header.name).toBe("Lan")
    expect(summaryParagraphs(v1Body.data.paper)).toEqual(["Campus app"])
    expect(v1Body.data.paper).toMatchObject({ version: 3, kind: "cv" })

    const v2 = {
      version: 2,
      header: {
        name: "Lan",
        email: "",
        phone: "",
        city: "",
        linkedin: "",
      },
      sections: [
        {
          id: "section-experience",
          kind: "experience",
          blocks: [
            {
              id: "role-1",
              type: "experience-entry",
              role: "Lead",
              company: "UIT",
              period: "Recently",
              bullets: [],
            },
          ],
        },
      ],
    }
    const jsonV2 = await postFile(
      app,
      owner.cookie,
      Buffer.from(JSON.stringify(v2)),
      "lan-v2.json",
      "application/json"
    )
    expect(jsonV2.status).toBe(200)
    const v2Body = (await jsonV2.json()) as { data: Stored }
    expect(v2Body.data.paper).toMatchObject({ version: 3, kind: "cv" })
    expect(v2Body.data.paper.blocks).toContainEqual(
      expect.objectContaining({
        id: "role-1",
        type: "experience",
        role: "Lead",
        company: "UIT",
        period: "Recently",
      })
    )
    expect(v2Body.data.checks).toContainEqual({
      id: "dates",
      kind: "dates",
      message: "Add when you did this role.",
      blockId: "role-1",
      resolved: false,
    })

    expect(await db.select().from(paperDocs)).toHaveLength(5)
    await client.close()
  })

  it("refuses Pages, an unknown type, a corrupt PDF, links, and a 9 MB file", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Bea",
      email: "bea-import@example.com",
    })

    const pages = await postFile(
      app,
      owner.cookie,
      Buffer.from("not a pdf"),
      "sample.pages",
      "application/vnd.apple.pages"
    )
    expect(pages.status).toBe(415)
    expect(await pages.json()).toMatchObject({
      error: { code: "FILE_UNSUPPORTED", message: IMPORT_PAGES_MESSAGE },
    })

    const unknown = await postFile(
      app,
      owner.cookie,
      Buffer.from([0, 1, 2, 3, 255]),
      "sample.xyz",
      "application/octet-stream"
    )
    expect(unknown.status).toBe(415)
    expect(await unknown.json()).toMatchObject({
      error: { code: "FILE_UNSUPPORTED", message: IMPORT_GENERIC_MESSAGE },
    })

    const corrupt = await postFile(
      app,
      owner.cookie,
      Buffer.from("%PDF-1.4 this is not a PDF"),
      "broken.pdf",
      "application/pdf"
    )
    expect(corrupt.status).toBe(400)
    expect(await corrupt.json()).toMatchObject({
      error: { message: IMPORT_FAILED_MESSAGE },
    })

    const google = await app.request("/api/paper/import", {
      method: "POST",
      headers: authHeaders(owner.cookie),
      body: JSON.stringify({
        link: "https://docs.google.com/document/d/abc",
      }),
    })
    expect(google.status).toBe(422)
    expect(await google.json()).toMatchObject({
      error: { code: "LINK_UNREADABLE", message: IMPORT_GOOGLE_MESSAGE },
    })

    const linked = await app.request("/api/paper/import", {
      method: "POST",
      headers: { Origin: testWebOrigin, Cookie: owner.cookie },
      body: (() => {
        const form = new FormData()
        form.set("link", "https://www.linkedin.com/in/example")
        return form
      })(),
    })
    expect(linked.status).toBe(422)
    expect(await linked.json()).toMatchObject({
      error: { code: "LINK_UNREADABLE", message: IMPORT_LINKEDIN_MESSAGE },
    })

    const huge = await postFile(
      app,
      owner.cookie,
      Buffer.alloc(9_000_000),
      "big.pdf",
      "application/pdf"
    )
    expect(huge.status).toBe(413)
    expect(await huge.json()).toMatchObject({
      error: { message: IMPORT_SIZE_MESSAGE },
    })

    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    await client.close()
  })
})
