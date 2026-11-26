import { richTextNodes } from "./paper-rich-edit.js"
import type { RichPaperDocument } from "./stored-document.js"

const PAPER_PREVIEW_LIMITS = Object.freeze({ lines: 12, chars: 160 })

export function paperPreviewLines(document: RichPaperDocument): string[] {
  const lines: string[] = []
  for (const node of richTextNodes(document)) {
    const text = node.content
      .map((run) => run.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim()
    if (!text) continue
    lines.push(Array.from(text).slice(0, PAPER_PREVIEW_LIMITS.chars).join(""))
    if (lines.length === PAPER_PREVIEW_LIMITS.lines) break
  }
  return lines
}
