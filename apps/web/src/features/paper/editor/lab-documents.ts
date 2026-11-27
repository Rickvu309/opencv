import {
  documentSchema,
  paperEngineBlank,
  type Document,
} from "@workspace/domain/paper-doc"
import en10 from "@workspace/paper-corpus/tests/fixtures/cvs/en-10.expected.json"
import vi01 from "@workspace/paper-corpus/tests/fixtures/cvs/vi-01.expected.json"

type CorpusLink = { text: string; href: string }
type CorpusBlock = {
  kind: string
  text?: string
  alt?: string
  list?: { kind: string; level: number }
  links?: CorpusLink[]
  rightTabStop?: { positionTwips: number }
  rows?: string[][]
}
type CorpusCv = { page: { marginMm: number }; blocks: CorpusBlock[] }

const A4_WIDTH_MPT = 595276
const TWIP_MPT = 50
const PHOTO_FILE_ID = "00000000-0000-4000-8000-000000000001"
const mmToMpt = (mm: number) => Math.round((mm * 72000) / 25.4)

const CORPUS: Record<string, CorpusCv> = { "en-10": en10, "vi-01": vi01 }

export const LAB_DOCUMENTS = ["blank", ...Object.keys(CORPUS)]

function runs(text: string | undefined, links: CorpusLink[] = []) {
  if (!text) return []
  const out: Record<string, unknown>[] = []
  let rest = text
  for (const link of links) {
    const found = rest.indexOf(link.text)
    if (found < 0) continue
    if (found > 0) out.push({ type: "text", text: rest.slice(0, found) })
    out.push({
      type: "text",
      text: link.text,
      marks: [{ type: "link", attrs: { href: link.href } }],
    })
    rest = rest.slice(found + link.text.length)
  }
  if (rest) out.push({ type: "text", text: rest })
  return out
}

function corpusBlock(block: CorpusBlock, n: number, contentWidth: number) {
  const id = `c${n + 1}`
  if (block.kind === "pageBreak") return { type: "page_break", attrs: { id } }
  if (block.kind === "image")
    return {
      type: "image",
      attrs: {
        id,
        fileId: PHOTO_FILE_ID,
        widthMpt: 96000,
        heightMpt: 96000,
        align: "left",
        alt: block.alt ?? "",
      },
    }
  if (block.kind === "table") {
    const rows = block.rows ?? [[""]]
    const columns = rows[0]?.length ?? 1
    const each = Math.floor(contentWidth / columns)
    return {
      type: "table",
      attrs: {
        id,
        borders: "all",
        columnsMpt: rows[0]!.map((_, col) =>
          col === columns - 1 ? contentWidth - each * (columns - 1) : each
        ),
      },
      content: rows.map((row) => ({
        type: "table_row",
        content: row.map((cell) => ({
          type: "table_cell",
          content: runs(cell),
        })),
      })),
    }
  }
  return {
    type: "text_block",
    attrs: {
      id,
      kind: block.kind,
      list: block.list?.kind ?? null,
      level: block.list?.level ?? 0,
      align: "left",
      lineSpacing: null,
      keepWithNext: null,
      ...(block.rightTabStop
        ? { rightTabMpt: block.rightTabStop.positionTwips * TWIP_MPT }
        : {}),
    },
    content: runs(block.text, block.links),
  }
}

export function labDocument(name: string | null): Document {
  const cv = name ? CORPUS[name] : undefined
  if (!cv) return paperEngineBlank.blankCv()
  const margin = mmToMpt(cv.page.marginMm)
  return documentSchema.parse({
    type: "doc",
    attrs: {
      schema: 1,
      template: "classic",
      page: {
        size: "A4",
        orientation: "portrait",
        marginsMpt: {
          top: margin,
          right: margin,
          bottom: margin,
          left: margin,
        },
      },
    },
    content: cv.blocks.map((block, n) =>
      corpusBlock(block, n, A4_WIDTH_MPT - 2 * margin)
    ),
  })
}
