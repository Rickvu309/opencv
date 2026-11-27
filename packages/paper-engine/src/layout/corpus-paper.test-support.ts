import { documentSchema, type Document } from "@workspace/domain/paper-doc"

type CorpusLink = { text: string; href: string }
type CorpusBlock = {
  kind: string
  text?: string
  alt?: string
  list?: { kind: "bullet" | "numbered"; level: number }
  links?: CorpusLink[]
  rightTabStop?: { positionTwips: number }
  rows?: string[][]
}
export type CorpusCv = {
  page: { widthMm: number; heightMm: number; marginMm: number }
  blocks: CorpusBlock[]
}

const mmToMpt = (mm: number) => Math.round((mm * 72000) / 25.4)
const A4 = { w: 595276, h: 841890 }
export const CORPUS_PHOTO_FILE_ID = "00000000-0000-4000-8000-000000000001"

function runs(text: string | undefined, links: CorpusLink[] = []) {
  if (!text) return []
  const out: Record<string, unknown>[] = []
  let rest = text
  for (const link of links) {
    const at = rest.indexOf(link.text)
    if (at < 0) continue
    if (at > 0) out.push({ type: "text", text: rest.slice(0, at) })
    out.push({
      type: "text",
      text: link.text,
      marks: [{ type: "link", attrs: { href: link.href } }],
    })
    rest = rest.slice(at + link.text.length)
  }
  if (rest) out.push({ type: "text", text: rest })
  return out
}

export function corpusDocument(cv: CorpusCv, prefix = "b"): Document {
  const margin = mmToMpt(cv.page.marginMm)
  const contentWidth = A4.w - 2 * margin
  const content = cv.blocks.map((block, index) => {
    const id = `${prefix}${index + 1}`
    if (block.kind === "pageBreak") return { type: "page_break", attrs: { id } }
    if (block.kind === "image") {
      return {
        type: "image",
        attrs: {
          id,
          fileId: CORPUS_PHOTO_FILE_ID,
          widthMpt: 96000,
          heightMpt: 96000,
          align: "left",
          alt: block.alt ?? "",
        },
      }
    }
    if (block.kind === "table") {
      const rows = block.rows ?? []
      const columns = rows[0]?.length ?? 1
      const each = Math.floor(contentWidth / columns)
      const columnsMpt = Array.from({ length: columns }, (_, col) =>
        col === columns - 1 ? contentWidth - each * (columns - 1) : each
      )
      return {
        type: "table",
        attrs: { id, columnsMpt, borders: "all" },
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
          ? { rightTabMpt: block.rightTabStop.positionTwips * 50 }
          : {}),
      },
      content: runs(block.text, block.links),
    }
  })
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
    content,
  })
}
