import { describe, expect, it } from "vitest"

import { files, paperPackageHeads } from "../db/schema.js"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../test/harness.js"
import { textPdf } from "./import-fixtures.test.js"
import {
  declaredPagesPdf,
  inflateBombPdf,
  manyEntriesDocx,
  manyItemsPdf,
  nestedPdf,
  wordBombDocx,
} from "./import-hostile-fixtures.test.js"
import { IMPORT_READ_LIMITS, IMPORT_TEXT_LIMITS } from "./import-limits.js"
import {
  IMPORT_BUSY_MESSAGE,
  IMPORT_FAILED_MESSAGE,
  IMPORT_PDF_HEAVY_MESSAGE,
  IMPORT_TEXT_LONG_MESSAGE,
  importParsers,
} from "./import-parse.js"
import { importedWordPage } from "./import-word.js"
import { readPackageZip } from "./package-zip.js"
import { IMPORT_LINE_BYTES, importedTextLines } from "./word/from-text.js"

const BOUNDS = { ms: 5_000, loopGapMs: 200, rssGrowthMb: 320 }

async function measured<T>(work: () => Promise<T>) {
  const before = process.memoryUsage.rss()
  let peak = before
  let last = performance.now()
  let loopGapMs = 0
  const tick = setInterval(() => {
    const now = performance.now()
    loopGapMs = Math.max(loopGapMs, now - last)
    last = now
    peak = Math.max(peak, process.memoryUsage.rss())
  }, 5)
  const start = performance.now()
  const outcome = await work().then(
    (value) => ({ ok: true as const, value }),
    (error: Error) => ({ ok: false as const, message: error.message })
  )
  const ms = performance.now() - start
  loopGapMs = Math.max(loopGapMs, performance.now() - last)
  clearInterval(tick)
  const rssGrowthMb = (peak - before) / 2 ** 20
  return { outcome, ms, loopGapMs, rssGrowthMb }
}

function expectBounded(result: Awaited<ReturnType<typeof measured>>) {
  expect(result.ms).toBeLessThan(BOUNDS.ms)
  expect(result.loopGapMs).toBeLessThan(BOUNDS.loopGapMs)
  expect(result.rssGrowthMb).toBeLessThan(BOUNDS.rssGrowthMb)
}

function importFile(name: string, bytes: Buffer) {
  return measured(() => importedWordPage({ name, mediaType: "", bytes }))
}

describe("hostile uploads stay bounded", () => {
  it("refuses a one-line text file of 8 MB before converting it", async () => {
    const result = await importFile(
      "cv.txt",
      Buffer.from("a ".repeat(3_950_000))
    )
    expect(result.outcome).toEqual({
      ok: false,
      message: IMPORT_TEXT_LONG_MESSAGE,
    })
    expectBounded(result)
    expect(result.ms).toBeLessThan(100)
  })

  it("refuses a text file of 5 million short lines before converting it", async () => {
    const result = await importFile(
      "cv.txt",
      Buffer.from("\n".repeat(5_000_000))
    )
    expect(result.outcome).toEqual({
      ok: false,
      message: IMPORT_TEXT_LONG_MESSAGE,
    })
    expectBounded(result)
    expect(result.ms).toBeLessThan(100)
  })

  it("refuses converter input over its caps before any pattern runs", () => {
    const start = performance.now()
    expect(
      importedTextLines("a".repeat(IMPORT_TEXT_LIMITS.textChars + 1))
    ).toMatchObject({ ok: false })
    expect(importedTextLines("x\n".repeat(99_000))).toMatchObject({
      ok: false,
      message: expect.stringContaining("2,000 lines"),
    })
    expect(
      importedTextLines(
        `Minh Anh\n${"a".repeat(IMPORT_TEXT_LIMITS.lineChars + 1)}`
      )
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("50,000 characters"),
    })
    expect(performance.now() - start).toBeLessThan(200)
  })

  it("converts adversarial lines just under the caps in linear time with every word kept", () => {
    const units = [" ", "-", "• ", "1", "a@", "(1) ", "+1-", "a"]
    for (const unit of units) {
      const line = unit.repeat(
        Math.floor((IMPORT_TEXT_LIMITS.lineChars - 1) / unit.length)
      )
      const start = performance.now()
      const read = importedTextLines(`Minh Anh\n${line}\n${line}`)
      expect(performance.now() - start).toBeLessThan(150)
      if (!read.ok) continue
      for (const piece of read.lines)
        expect(
          new TextEncoder().encode(piece.text).byteLength
        ).toBeLessThanOrEqual(IMPORT_LINE_BYTES)
    }
    const words = Array.from({ length: 2_000 }, (_, index) => `word${index}`)
    const read = importedTextLines(`Minh Anh\n${words.join(" ")}`)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(
      read.lines
        .slice(1)
        .map((line) => line.text)
        .join(" ")
    ).toBe(words.join(" "))
  })

  it("refuses a PDF whose stream inflates to 256 MB, stopping at the cap", async () => {
    const result = await importFile(
      "cv.pdf",
      await inflateBombPdf(256 * 2 ** 20)
    )
    expect(result.outcome).toEqual({
      ok: false,
      message: IMPORT_PDF_HEAVY_MESSAGE,
    })
    expectBounded(result)
  })

  it("bounds a PDF with one page of a million text items", async () => {
    const result = await importFile("cv.pdf", manyItemsPdf(1_000_000))
    expectBounded(result)
    if (!result.outcome.ok)
      expect([IMPORT_TEXT_LONG_MESSAGE, IMPORT_PDF_HEAVY_MESSAGE]).toContain(
        result.outcome.message
      )
  })

  it("bounds a PDF that declares 100,000 pages", async () => {
    const result = await importFile("cv.pdf", declaredPagesPdf(100_000))
    expectBounded(result)
  })

  it("refuses a PDF with a deeply nested object tree", async () => {
    const result = await importFile("cv.pdf", nestedPdf(100_000))
    expect(result.outcome).toEqual({
      ok: false,
      message: IMPORT_FAILED_MESSAGE,
    })
    expectBounded(result)
  })

  it("refuses a Word file whose member inflates past the cap, whether its size is declared or hidden", async () => {
    const declared = await wordBombDocx(256 * 2 ** 20, 256 * 2 ** 20)
    const hidden = await wordBombDocx(256 * 2 ** 20, 1_000)
    for (const bytes of [declared, hidden]) {
      const result = await measured(() => readPackageZip(bytes))
      expect(result.outcome.ok).toBe(false)
      expectBounded(result)
    }
    const letter = await measured(() => importParsers.docxText(hidden))
    expect(letter.outcome.ok).toBe(false)
    expectBounded(letter)
  })

  it("refuses a Word file with ten thousand members", async () => {
    const bytes = manyEntriesDocx(10_000)
    const word = await measured(() => readPackageZip(bytes))
    expect(word.outcome.ok).toBe(false)
    expectBounded(word)
    const letter = await measured(() => importParsers.docxText(bytes))
    expect(letter.outcome).toEqual({ ok: false, message: "import-zip-entries" })
    expectBounded(letter)
  })

  it("reads ten honest PDFs sent at once, asks an eleventh to retry, and other requests still answer", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owner = await signUp(app, {
      name: "Ten",
      email: "ten-imports@example.com",
    })
    const uploads = Array.from({ length: 11 }, (_, index) => {
      const form = new FormData()
      form.set(
        "file",
        new File(
          [new Uint8Array(textPdf(`Campus newsletter ${index}`))],
          "cv.pdf",
          {
            type: "application/pdf",
          }
        )
      )
      return Promise.resolve(
        app.request("/api/paper/import", {
          method: "POST",
          headers: { Origin: testWebOrigin, Cookie: owner.cookie },
          body: form,
        })
      )
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const asked = performance.now()
    const quick = await app.request("/api/public-config")
    const quickMs = performance.now() - asked
    const responses = await Promise.all(uploads)
    expect(quick.status).toBe(200)
    expect(quickMs).toBeLessThan(250)
    const statuses = responses.map((response) => response.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(10)
    const busy = responses.filter((response) => response.status === 409)
    expect(busy).toHaveLength(1)
    expect(await busy[0]!.json()).toMatchObject({
      error: { message: IMPORT_BUSY_MESSAGE },
    })
    expect(await db.select().from(paperPackageHeads)).toHaveLength(10)
    expect(await db.select().from(files)).toHaveLength(10)
    expect(IMPORT_READ_LIMITS.parallel + IMPORT_READ_LIMITS.waiting).toBe(10)
    await client.close()
  })
})
