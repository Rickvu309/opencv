import { readFile, readdir } from "node:fs/promises"

import {
  createLayouter,
  paperFontMetrics,
  seededIds,
  type LineBox,
  type Page,
} from "@workspace/paper-engine"
import { extractImages, getDocumentProxy, getResolvedPDFJS } from "unpdf"
import { describe, expect, it } from "vitest"

import { readCorpusCv } from "../../../../../packages/paper-engine/cli/corpus-cv.js"
import { CORPUS_PHOTO_FILE_ID } from "../../../../../packages/paper-engine/src/layout/corpus-paper.test-support.js"
import manifest from "../../../../../packages/paper-fonts/fonts.json" with { type: "json" }
import { readPackageZip } from "../import/package-zip.js"
import { writePdf } from "./write-pdf.js"

const corpus = new URL(
  "../../../../../packages/paper-corpus/tests/fixtures/cvs/",
  import.meta.url
)
const fontDirectory = new URL("../../../../web/public/fonts/", import.meta.url)
const fonts = new Map(
  await Promise.all(
    manifest.faces.map(async ({ face, file }) => {
      const bytes = await readFile(new URL(file, fontDirectory))
      return [face, bytes] as const
    })
  )
)
const ids = (await readdir(corpus))
  .filter((file) => file.endsWith(".expected.json"))
  .sort()
  .map((file) => file.replace(".expected.json", ""))

const normalizeSpaces = (text: string) => text.replace(/\s+/g, " ").trim()

function lineText(line: LineBox) {
  let text = line.marker ? `${line.marker.text} ` : ""
  let end: number | undefined
  for (const segment of line.segments) {
    if (end !== undefined && segment.x > end + 1) text += " "
    text += segment.text
    end = segment.x + segment.w
  }
  return normalizeSpaces(text)
}

type PdfPage = Awaited<
  ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>
>

async function expectPage(page: Page, pdfPage: PdfPage) {
  expect(pdfPage.view).toEqual([0, 0, page.size.w / 1000, page.size.h / 1000])
  const { items } = await pdfPage.getTextContent({ disableNormalization: true })
  const text = items
    .filter((item) => "str" in item)
    .filter((item) => item.str !== "")
  const lines = page.boxes.filter(
    (box): box is LineBox => box.kind === "line" && lineText(box) !== ""
  )

  for (const line of lines) {
    const [firstRun] = line.segments
    const start = (line.marker?.x ?? firstRun?.x ?? line.rect.x) / 1000
    const baseline = (page.size.h - line.baseline) / 1000
    const cell = line.cell
      ? page.boxes.find(
          (box) =>
            box.kind === "cell" &&
            box.block === line.block &&
            box.row === line.cell?.row &&
            box.col === line.cell.col
        )
      : undefined
    const right = cell ? (cell.rect.x + cell.rect.w) / 1000 : Infinity
    const runs = text.filter(
      (item) =>
        Math.abs(item.transform[5] - baseline) < 0.001 &&
        item.transform[4] >= start - 0.001 &&
        item.transform[4] < right
    )
    let drawn = ""
    let end = start
    for (const item of runs) {
      if (item.transform[4] > end + 1) drawn += " "
      drawn += item.str
      end = item.transform[4] + item.width
    }
    expect(runs[0]?.transform[4]).toBeCloseTo(start, 3)
    expect(normalizeSpaces(drawn)).toBe(lineText(line))
  }
}

describe("PDF pages from the shared Paper layout", () => {
  it("covers all 20 English and Vietnamese CVs", () => {
    expect(ids).toHaveLength(20)
  })

  it.each(ids)("%s keeps the page sizes, lines and text", async (id) => {
    const layout = createLayouter(paperFontMetrics).layout(
      readCorpusCv(id),
      null
    )
    const files = new Map<string, Uint8Array>()
    const photoPage = layout.pages.find((page) =>
      page.boxes.some((box) => box.kind === "image")
    )
    if (photoPage) {
      const word = await readPackageZip(
        await readFile(new URL(`${id}.docx`, corpus))
      )
      const photo = word.files.get("word/media/image1.png")
      if (!photo) throw new Error(`Missing corpus photo in ${id}`)
      files.set(CORPUS_PHOTO_FILE_ID, photo)
    }

    const bytes = await writePdf(layout, files, fonts)
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    try {
      expect(pdf.numPages).toBe(layout.pages.length)
      for (const page of layout.pages) {
        await expectPage(page, await pdf.getPage(page.index + 1))
      }
      if (photoPage) {
        const photos = await extractImages(pdf, photoPage.index + 1)
        expect(photos).toHaveLength(1)
        expect(photos[0]?.data.length).toBeGreaterThan(0)
      }
    } finally {
      await pdf.loadingTask.destroy()
    }
  })

  it("paints a divider from the layout", async () => {
    const cv = readCorpusCv("en-10")
    const layout = createLayouter(paperFontMetrics).layout(
      { ...cv, content: [{ type: "divider", attrs: { id: seededIds()() } }] },
      null
    )
    const rule = layout.pages[0]?.boxes.find((box) => box.kind === "rule")
    expect(rule).toBeDefined()

    const bytes = await writePdf(layout, new Map(), fonts)
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    try {
      const page = await pdf.getPage(1)
      const { fnArray } = await page.getOperatorList()
      const { OPS } = await getResolvedPDFJS()
      expect(fnArray).toContain(OPS.constructPath)
    } finally {
      await pdf.loadingTask.destroy()
    }
  })
})
