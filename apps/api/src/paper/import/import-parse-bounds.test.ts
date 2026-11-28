import { personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"

import { withDatabase } from "../../db/context.js"

import { files, paperDocs } from "../../db/schema.js"
import { registry } from "../../registry/registry.js"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../../test/harness.js"
import { pagedPdf, textDocx, textPdf } from "./import-fixtures.test.js"
import {
  IMPORT_GENERIC_MESSAGE,
  IMPORT_PDF_HEAVY_MESSAGE,
  IMPORT_PDF_PAGES_MESSAGE,
  importParsers,
} from "./import-parse.js"
import { IMPORT_FILE_CAP, IMPORT_SIZE_MESSAGE } from "../store.js"

type Published = { docId: string }

async function engineText(
  db: Parameters<typeof createTestApp>[0],
  docId: string
) {
  const [row] = await db
    .select({ userId: paperDocs.userId })
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  const read = (await withDatabase(db, () =>
    registry.read(
      "paper.read",
      { docId, view: "engine" },
      personActor(row!.userId)
    )
  )) as { doc: { content: unknown } }
  return JSON.stringify(read.doc.content)
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

const realPdfText = importParsers.pdfText
const realDocxText = importParsers.docxText

afterEach(() => {
  importParsers.timeoutMs = 10_000
  importParsers.pdfText = realPdfText
  importParsers.docxText = realDocxText
  importParsers.onInsert = null
})

describe("paper import bounds", () => {
  it("refuses a PDF over 20 pages instead of dropping pages, and reads all 20 of a 20-page PDF", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Page",
      email: "page-import@example.com",
    })
    const long = await postFile(
      app,
      owner.cookie,
      pagedPdf(Array.from({ length: 21 }, (_, index) => `Page ${index}`)),
      "many.pdf",
      "application/pdf"
    )
    expect(long.status).toBe(415)
    expect(await long.json()).toMatchObject({
      error: { code: "FILE_UNSUPPORTED", message: IMPORT_PDF_PAGES_MESSAGE },
    })
    expect(await db.select().from(paperDocs)).toEqual([])
    expect(await db.select().from(files)).toEqual([])
    const pages = Array.from({ length: 20 }, (_, index) => {
      if (index === 0) return "FIRST-PAGE"
      if (index === 19) return "CAP-PAGE"
      return ""
    })
    const response = await postFile(
      app,
      owner.cookie,
      pagedPdf(pages),
      "twenty.pdf",
      "application/pdf"
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Published }
    const text = await engineText(db, body.data.docId)
    expect(text).toContain("FIRST-PAGE")
    expect(text).toContain("CAP-PAGE")
    await client.close()
  })

  it("stops the PDF reader when the deadline fires and stores nothing", async () => {
    importParsers.timeoutMs = 1
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
    expect(response.status).toBe(415)
    expect(await response.json()).toMatchObject({
      error: { message: IMPORT_PDF_HEAVY_MESSAGE },
    })
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

  it("reads Word, PDF and text by their bytes instead of the declared type or name", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Sniff",
      email: "sniff-import@example.com",
    })
    const cases = [
      [textPdf("Campus newsletter"), "sample.pdf", "", "Campus newsletter"],
      [
        textDocx("Weekly newsletter for students"),
        "notes",
        "",
        "Weekly newsletter for students",
      ],
      [
        Buffer.from("Plain sentence from a text file"),
        "notes.pdf",
        "application/pdf",
        "Plain sentence from a text file",
      ],
      [Buffer.from("First paragraph"), "notes.txt", "", "First paragraph"],
    ] as const
    for (const [bytes, name, type, words] of cases) {
      const response = await postFile(app, owner.cookie, bytes, name, type)
      expect(response.status).toBe(200)
      const body = (await response.json()) as { data: Published }
      expect(await engineText(db, body.data.docId)).toContain(words)
    }
    expect(await db.select().from(paperDocs)).toHaveLength(4)
    await client.close()
  })

  it("makes no Word page when the request is cancelled after the file is read", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Mid",
      email: "mid-import@example.com",
    })
    const controller = new AbortController()
    importParsers.pdfText = async () => {
      controller.abort()
      return "Campus newsletter"
    }
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
    const body = (await text.json()) as { data: Published }
    expect(await engineText(db, body.data.docId)).toContain("Café résumé")
    expect(await db.select().from(paperDocs)).toHaveLength(1)
    await client.close()
  })
})
