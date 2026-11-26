import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { files, paperDocs } from "../../db/schema.js"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../../test/harness.js"
import { textPdf } from "./import-fixtures.test.js"
import {
  declaredPagesPdf,
  hexWrappedBombPdf,
  inflateBombPdf,
  manyEntriesDocx,
  manyItemsPdf,
  nestedPdf,
  wordBombDocx,
} from "./import-hostile-fixtures.test.js"
import { IMPORT_READ_LIMITS, IMPORT_TEXT_LIMITS } from "./import-limits.js"
import {
  IMPORT_ACCOUNT_BUSY_MESSAGE,
  IMPORT_PDF_UNREADABLE_MESSAGE,
  IMPORT_PDF_HEAVY_MESSAGE,
  IMPORT_TEXT_LONG_MESSAGE,
  importParsers,
} from "./import-parse.js"
import { importedPaper } from "./import-word.js"
import { readPackageZip } from "./package-zip.js"
import { IMPORT_LINE_BYTES, importedTextLines } from "./import-text-lines.js"

const BOUNDS = { ms: 5_000, loopGapMs: 200, rssGrowthMb: 320 }
const WORKER_START_MS = 2_000

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

const SLOW_RUNNER_MS = 1_000

function fastestMs(run: () => void, runs = 3) {
  let fastest = Number.POSITIVE_INFINITY
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now()
    run()
    fastest = Math.min(fastest, performance.now() - start)
  }
  return fastest
}

function expectBounded(
  result: Awaited<ReturnType<typeof measured>>,
  ms = BOUNDS.ms
) {
  expect(result.ms).toBeLessThan(ms)
  expect(result.loopGapMs).toBeLessThan(BOUNDS.loopGapMs)
  expect(result.rssGrowthMb).toBeLessThan(BOUNDS.rssGrowthMb)
}

function importFile(name: string, bytes: Buffer) {
  return measured(() =>
    importedPaper({ name, mediaType: "", bytes }, { owner: randomUUID() })
  )
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
    expect(result.ms).toBeLessThan(SLOW_RUNNER_MS)
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
    expect(result.ms).toBeLessThan(SLOW_RUNNER_MS)
  })

  it("refuses converter input over its caps before any pattern runs", () => {
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
    expect(
      fastestMs(() => {
        importedTextLines("a".repeat(IMPORT_TEXT_LIMITS.textChars + 1))
        importedTextLines("x\n".repeat(99_000))
        importedTextLines(
          `Minh Anh\n${"a".repeat(IMPORT_TEXT_LIMITS.lineChars + 1)}`
        )
      })
    ).toBeLessThan(SLOW_RUNNER_MS)
  })

  it("converts adversarial lines just under the caps in linear time with every word kept", () => {
    const units = [" ", "-", "• ", "1", "a@", "(1) ", "+1-", "a"]
    for (const unit of units) {
      const line = unit.repeat(
        Math.floor((IMPORT_TEXT_LIMITS.lineChars - 1) / unit.length)
      )
      const text = `Minh Anh\n${line}\n${line}`
      const read = importedTextLines(text)
      expect(
        fastestMs(() => {
          importedTextLines(text)
        })
      ).toBeLessThan(SLOW_RUNNER_MS)
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

  it("stops a PDF whose bomb hides behind a second filter with the worker's memory watch, heap limit or deadline", async () => {
    const result = await importFile(
      "cv.pdf",
      await hexWrappedBombPdf(256 * 2 ** 20)
    )
    expect(result.outcome).toEqual({
      ok: false,
      message: IMPORT_PDF_HEAVY_MESSAGE,
    })
    expectBounded(result)
  })

  it("bounds a PDF with one page of a million text items", async () => {
    const result = await importFile("cv.pdf", manyItemsPdf(1_000_000))
    expectBounded(result, importParsers.timeoutMs + WORKER_START_MS)
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
      message: IMPORT_PDF_UNREADABLE_MESSAGE,
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
    const letter = await measured(() =>
      importParsers.docxText(hidden, { owner: randomUUID() })
    )
    expect(letter.outcome.ok).toBe(false)
    expectBounded(letter)
  })

  it("refuses a Word file with ten thousand members", async () => {
    const bytes = manyEntriesDocx(10_000)
    const word = await measured(() => readPackageZip(bytes))
    expect(word.outcome.ok).toBe(false)
    expectBounded(word)
    const letter = await measured(() =>
      importParsers.docxText(bytes, { owner: randomUUID() })
    )
    expect(letter.outcome).toEqual({ ok: false, message: "import-zip-entries" })
    expectBounded(letter)
  })

  it("reads one PDF per account at a time, tells the same account plainly to wait, reads ten accounts sent at once, and other requests still answer", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const owners: Array<{ cookie: string }> = []
    for (let index = 0; index < 10; index += 1)
      owners.push(
        await signUp(app, {
          name: `Reader ${index}`,
          email: `ten-imports-${index}@example.com`,
        })
      )
    const send = (cookie: string, index: number) => {
      const form = new FormData()
      form.set(
        "file",
        new File(
          [new Uint8Array(textPdf(`Campus newsletter ${index}`))],
          "cv.pdf",
          { type: "application/pdf" }
        )
      )
      return Promise.resolve(
        app.request("/api/paper/import", {
          method: "POST",
          headers: { Origin: testWebOrigin, Cookie: cookie },
          body: form,
        })
      )
    }
    const same = await Promise.all(
      Array.from({ length: 11 }, (_, index) => send(owners[0]!.cookie, index))
    )
    const sameStatuses = same.map((response) => response.status)
    expect(
      sameStatuses.filter((status) => status === 200).length
    ).toBeLessThanOrEqual(2)
    const waits = same.filter((response) => response.status === 429)
    expect(waits.length).toBeGreaterThanOrEqual(9)
    expect(waits[0]!.headers.get("retry-after")).toBe("10")
    expect(await waits[0]!.json()).toMatchObject({
      error: { message: IMPORT_ACCOUNT_BUSY_MESSAGE },
    })
    const served = sameStatuses.filter((status) => status === 200).length
    const uploads = owners.map((owner, index) => send(owner.cookie, index))
    await new Promise((resolve) => setTimeout(resolve, 50))
    const asked = performance.now()
    const quick = await app.request("/api/public-config")
    const quickMs = performance.now() - asked
    const responses = await Promise.all(uploads)
    expect(quick.status).toBe(200)
    expect(quickMs).toBeLessThan(250)
    expect(responses.map((response) => response.status)).toEqual(
      Array.from({ length: 10 }, () => 200)
    )
    expect(await db.select().from(paperDocs)).toHaveLength(10 + served)
    expect(await db.select().from(files)).toHaveLength(10 + served)
    expect(IMPORT_READ_LIMITS.workers + IMPORT_READ_LIMITS.waiting).toBe(14)
    await client.close()
  })
})
