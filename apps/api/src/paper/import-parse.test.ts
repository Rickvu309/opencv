import {
  IMPORT_GOOGLE_MESSAGE,
  IMPORT_LINKEDIN_MESSAGE,
  IMPORT_PAGES_MESSAGE,
  IMPORT_PHONE_MESSAGE,
  emptyCvDocument,
} from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { files, paperDocs } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { pagedPdf, textDocx, textPdf } from "./import-fixtures.test.js"
import {
  IMPORT_FAILED_MESSAGE,
  IMPORT_GENERIC_MESSAGE,
  importParsers,
} from "./import-parse.js"
import { IMPORT_FILE_CAP, IMPORT_SIZE_MESSAGE } from "./store.js"

const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type Stored = {
  document: {
    version?: number
    name?: string
    summary?: string
    sections?: {
      kind: string
      blocks: { type: string; text?: string; id?: string }[]
    }[]
  }
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
    const pdfText = JSON.stringify(pdfBody.data.document)
    expect(pdfBody.data.document.version).toBe(2)
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
    expect(JSON.stringify(docxBody.data.document)).toContain(
      "Weekly newsletter for students"
    )
    expect(docxBody.data.document.version).toBe(2)

    const text = await postFile(
      app,
      owner.cookie,
      Buffer.from("First paragraph\n\nSecond paragraph"),
      "notes.txt",
      "text/plain"
    )
    expect(text.status).toBe(200)
    const textBody = (await text.json()) as { data: Stored }
    const summary = textBody.data.document.sections?.find(
      (section) => section.kind === "summary"
    )
    expect(summary?.blocks.map((block) => block.text)).toEqual([
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
    expect(v1Body.data.document).toMatchObject({
      name: "Lan",
      summary: "Campus app",
    })
    expect(v1Body.data.document.version).toBeUndefined()

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
    expect(v2Body.data.document.version).toBe(2)
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

const realPdfText = importParsers.pdfText
const realDocxText = importParsers.docxText
const realOpenPdf = importParsers.openPdf

afterEach(() => {
  importParsers.timeoutMs = 10_000
  importParsers.pdfText = realPdfText
  importParsers.docxText = realDocxText
  importParsers.openPdf = realOpenPdf
  importParsers.onInsert = null
})

describe("paper import bounds", () => {
  it("reads only the first 20 pages of a 200-page PDF", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Page",
      email: "page-import@example.com",
    })
    const pages = Array.from({ length: 200 }, (_, index) => {
      if (index === 0) return "FIRST-PAGE"
      if (index === 19) return "CAP-PAGE"
      if (index === 20) return "PAST-CAP"
      if (index === 199) return "LAST-PAGE"
      return ""
    })
    const response = await postFile(
      app,
      owner.cookie,
      pagedPdf(pages),
      "many.pdf",
      "application/pdf"
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Stored }
    const text = JSON.stringify(body.data.document)
    expect(text).toContain("FIRST-PAGE")
    expect(text).toContain("CAP-PAGE")
    expect(text).not.toContain("PAST-CAP")
    expect(text).not.toContain("LAST-PAGE")
    await client.close()
  })

  it("destroys the PDF parser when the deadline fires and stores nothing", async () => {
    importParsers.timeoutMs = 40
    let releaseHang: (error: Error) => void = () => undefined
    const destroy = vi.fn(() => {
      releaseHang(new Error("destroyed"))
    })
    importParsers.openPdf = async () => ({
      numPages: 1,
      getPage: async () => ({
        getTextContent: () =>
          new Promise<never>((_resolve, reject) => {
            releaseHang = reject
          }),
      }),
      destroy,
    })
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Slow",
      email: "slow-import@example.com",
    })
    const response = await postFile(
      app,
      owner.cookie,
      textPdf("Campus newsletter"),
      "slow.pdf",
      "application/pdf"
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { message: IMPORT_FAILED_MESSAGE },
    })
    expect(destroy).toHaveBeenCalledOnce()
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    await client.close()
  })

  it("refuses a declared length over the cap before parsing", async () => {
    let parsed = false
    importParsers.pdfText = async () => {
      parsed = true
      return "Secret"
    }
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Huge",
      email: "huge-import@example.com",
    })
    const response = await app.request("/api/paper/import", {
      method: "POST",
      headers: {
        Origin: testWebOrigin,
        Cookie: owner.cookie,
        "content-length": "9000000",
      },
      body: formFile(textPdf("Secret"), "sample.pdf", "application/pdf"),
    })
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      error: { message: IMPORT_SIZE_MESSAGE },
    })
    expect(parsed).toBe(false)
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    await client.close()
  })

  it("leaves no document and no file when the request is cancelled", async () => {
    let release: (text: string) => void = () => undefined
    let markStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    importParsers.pdfText = () =>
      new Promise((resolve) => {
        markStarted()
        release = resolve
      })
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Stop",
      email: "stop-import@example.com",
    })
    const controller = new AbortController()
    const pending = Promise.resolve(
      app.request("/api/paper/import", {
        method: "POST",
        headers: { Origin: testWebOrigin, Cookie: owner.cookie },
        body: formFile(
          textPdf("Campus newsletter"),
          "slow.pdf",
          "application/pdf"
        ),
        signal: controller.signal,
      })
    )
    await started
    controller.abort()
    release("Campus newsletter")
    await pending.catch(() => undefined)
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    await client.close()
  })

  it("stores at most 200 KB of DOCX text and refuses a zip with too many entries", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Doc",
      email: "doc-import@example.com",
    })
    const capped = await postFile(
      app,
      owner.cookie,
      textDocx(`${"A".repeat(200_000)}DOCX-TAIL`),
      "long.docx",
      WORD
    )
    expect(capped.status).toBe(200)
    const cappedBody = (await capped.json()) as { data: Stored }
    const text = JSON.stringify(cappedBody.data.document)
    expect(text).toContain("A")
    expect(text).not.toContain("DOCX-TAIL")

    const bomb = await postFile(
      app,
      owner.cookie,
      textDocx("Hello zip cap", 300),
      "bomb.docx",
      WORD
    )
    expect(bomb.status).toBe(400)
    expect(await bomb.json()).toMatchObject({
      error: { message: IMPORT_FAILED_MESSAGE },
    })
    expect(await db.select().from(files)).toHaveLength(1)
    await client.close()
  })

  it("sniffs PDF, DOCX, and text bytes instead of the declared type", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Sniff",
      email: "sniff-import@example.com",
    })

    const pdf = await postFile(
      app,
      owner.cookie,
      textPdf("Campus newsletter"),
      "sample.pdf",
      ""
    )
    expect(pdf.status).toBe(200)
    const pdfBody = (await pdf.json()) as { data: Stored }
    expect(JSON.stringify(pdfBody.data.document)).toContain("Campus newsletter")

    const docx = await postFile(
      app,
      owner.cookie,
      textDocx("Weekly newsletter for students"),
      "notes.docx",
      ""
    )
    expect(docx.status).toBe(200)
    const docxBody = (await docx.json()) as { data: Stored }
    expect(JSON.stringify(docxBody.data.document)).toContain(
      "Weekly newsletter for students"
    )

    const renamed = await postFile(
      app,
      owner.cookie,
      Buffer.from("Plain sentence from a text file"),
      "notes.pdf",
      "application/pdf"
    )
    expect(renamed.status).toBe(200)
    const renamedBody = (await renamed.json()) as { data: Stored }
    expect(JSON.stringify(renamedBody.data.document)).toContain(
      "Plain sentence from a text file"
    )

    const text = await postFile(
      app,
      owner.cookie,
      Buffer.from("First paragraph"),
      "notes.txt",
      ""
    )
    expect(text.status).toBe(200)
    const textBody = (await text.json()) as { data: Stored }
    expect(JSON.stringify(textBody.data.document)).toContain("First paragraph")
    await client.close()
  })

  it("leaves no document when the request aborts during the insert", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Mid",
      email: "mid-import@example.com",
    })
    const controller = new AbortController()
    importParsers.onInsert = () => controller.abort()
    const response = await Promise.resolve(
      app.request("/api/paper/import", {
        method: "POST",
        headers: { Origin: testWebOrigin, Cookie: owner.cookie },
        body: formFile(
          textPdf("Campus newsletter"),
          "slow.pdf",
          "application/pdf"
        ),
        signal: controller.signal,
      })
    ).catch(() => undefined)
    if (response) expect(response.status).not.toBe(200)
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    await client.close()
  })

  it("refuses a chunked body with no content-length once it crosses 8 MB", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Chunk",
      email: "chunk-import@example.com",
    })
    const boundary = "----cap"
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.pdf"\r\nContent-Type: application/pdf\r\n\r\n`
    const tail = `\r\n--${boundary}--\r\n`
    const planned = head.length + IMPORT_FILE_CAP + 200_000 + tail.length
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= planned) {
          controller.close()
          return
        }
        const size = Math.min(64 * 1024, planned - pulled)
        const chunk = new Uint8Array(size)
        if (pulled < head.length) {
          chunk.set(Buffer.from(head.slice(pulled, pulled + size)))
        }
        pulled += size
        controller.enqueue(chunk)
      },
    })
    const request = new Request("http://localhost/api/paper/import", {
      method: "POST",
      headers: {
        Origin: testWebOrigin,
        Cookie: owner.cookie,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: stream,
      duplex: "half",
    })
    expect(request.headers.get("content-length")).toBeNull()
    const response = await app.request(request)
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      error: { message: IMPORT_SIZE_MESSAGE },
    })
    expect(pulled).toBeGreaterThan(IMPORT_FILE_CAP)
    expect(pulled).toBeLessThanOrEqual(IMPORT_FILE_CAP + 128 * 1024)
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    await client.close()
  })

  it("refuses markup disguised as text and still imports UTF-8 text", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Mark",
      email: "mark-import@example.com",
    })
    const svg = Buffer.from(
      "<svg xmlns='http://www.w3.org/2000/svg'><text>Campus</text></svg>"
    )
    const html = Buffer.from("<!DOCTYPE html><html><body>Campus</body></html>")
    const refused = [
      ["graphic.pdf", svg],
      ["graphic.txt", svg],
      ["page.pdf", html],
      ["page.txt", html],
      ["binary.txt", Buffer.from([0, 1, 2, 3, 255])],
    ] as const
    for (const [name, bytes] of refused) {
      const response = await postFile(app, owner.cookie, bytes, name, "")
      expect(response.status).toBe(415)
      expect(await response.json()).toMatchObject({
        error: { code: "FILE_UNSUPPORTED", message: IMPORT_GENERIC_MESSAGE },
      })
    }
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    const text = await postFile(
      app,
      owner.cookie,
      Buffer.from("Café résumé for the campus role"),
      "notes.txt",
      "text/plain"
    )
    expect(text.status).toBe(200)
    const body = (await text.json()) as { data: Stored }
    expect(JSON.stringify(body.data.document)).toContain("Café résumé")
    expect(await db.select().from(paperDocs)).toHaveLength(1)
    expect(await db.select().from(files)).toHaveLength(1)
    await client.close()
  })
})
