import { z } from "zod"
import {
  richPaperDocumentSchema,
  type RichPaperDocument,
} from "./stored-document.js"
import {
  formatRunSchema,
  formatRunsSchema,
  mergeFormatRuns,
  type FormatNode,
  type FormatRun,
} from "./native-formatting.js"
import { canonical } from "./presentation-values.js"

const range = z.object({
  blockId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  before: z.string().max(100000),
})
const richTextEditSchema = z.discriminatedUnion("op", [
  range
    .extend({ op: z.literal("replaceText"), text: z.string().max(100000) })
    .strict(),
  range
    .extend({
      op: z.literal("formatText"),
      marks: formatRunSchema.omit({ text: true }),
    })
    .strict(),
])
export const richTextEditsSchema = z.array(richTextEditSchema).min(1).max(30)
type RichTextEdit = z.output<typeof richTextEditSchema>
export const richChangeSchema = z
  .object({
    blockId: z.string(),
    before: formatRunsSchema,
    after: formatRunsSchema,
  })
  .strict()
export type RichChange = z.output<typeof richChangeSchema>
type TextNode = Extract<FormatNode, { content: FormatRun[] }>

export function richTextNodes(document: RichPaperDocument): TextNode[] {
  const result: TextNode[] = []
  const visit = (node: FormatNode) => {
    if ("content" in node) result.push(node)
    if ("children" in node) node.children.forEach(visit)
  }
  for (const section of document.flow.children)
    for (const node of section.children)
      if (
        node.type !== "table" &&
        node.type !== "photo" &&
        node.type !== "pageBreak"
      )
        visit(node)
  return result
}

function slice(runs: FormatRun[], from: number, to: number): FormatRun[] {
  let offset = 0
  return runs.flatMap((run) => {
    const start = Math.max(from - offset, 0)
    const end = Math.min(to - offset, run.text.length)
    offset += run.text.length
    return end > start ? [{ ...run, text: run.text.slice(start, end) }] : []
  })
}

export function prepareRichEdit(
  document: RichPaperDocument,
  edits: readonly RichTextEdit[]
) {
  const next = richPaperDocumentSchema.parse(document)
  const nodes = new Map<string, TextNode>(
    richTextNodes(next).map((node) => [node.id, node])
  )
  const changes = new Map<string, RichChange>()
  for (const edit of edits) {
    const node = nodes.get(edit.blockId)
    if (!node)
      throw new Error(
        "Choose a text passage. Coach cannot edit tables, photos or page layout."
      )
    const text = node.content.map((run) => run.text).join("")
    if (
      edit.to < edit.from ||
      edit.to > text.length ||
      text.slice(edit.from, edit.to) !== edit.before
    )
      throw new Error(
        "This passage changed. Read the document again before proposing an edit."
      )
    const prefix = slice(node.content, 0, edit.from)
    const suffix = slice(node.content, edit.to, text.length)
    const selected = slice(node.content, edit.from, edit.to)
    const inherited =
      selected[0] ??
      slice(node.content, Math.max(0, edit.from - 1), edit.from)[0]
    const middle =
      edit.op === "formatText"
        ? selected.map((run) => ({ ...run, ...edit.marks }))
        : edit.text
          ? [{ ...inherited, text: edit.text }]
          : []
    const after = mergeFormatRuns([...prefix, ...middle, ...suffix])
    if (!changes.has(node.id))
      changes.set(node.id, { blockId: node.id, before: node.content, after })
    node.content = after
    const change = changes.get(node.id)
    if (change) change.after = after
  }
  const changed = [...changes.values()].filter(
    (change) => canonical(change.before) !== canonical(change.after)
  )
  if (!changed.length)
    throw new Error("This proposal does not change the document.")
  return { document: richPaperDocumentSchema.parse(next), changes: changed }
}

export function reverseRichChanges(
  document: RichPaperDocument,
  changes: RichChange[]
) {
  const next = richPaperDocumentSchema.parse(document)
  const nodes = new Map<string, TextNode>(
    richTextNodes(next).map((node) => [node.id, node])
  )
  for (const change of changes) {
    const node = nodes.get(change.blockId)
    if (!node || canonical(node.content) !== canonical(change.after))
      throw new Error(
        "This passage changed after the Coach edit. Undo was skipped to keep your later writing."
      )
    node.content = change.before
  }
  return richPaperDocumentSchema.parse(next)
}
