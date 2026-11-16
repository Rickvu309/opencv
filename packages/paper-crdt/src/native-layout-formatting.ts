import type { Node, Mark } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"
import { yUndoPluginKey } from "y-prosemirror"
import {
  effectiveRunDecorations,
  effectiveParagraphStyle,
  paragraphInlineValues,
  inlinePatchSchema,
  inlineSchema,
  paragraphSchema,
  type InlinePresentation,
} from "@workspace/domain/internal/paper-presentation"
import type { FlowBinding } from "./native-layout-flow.js"
import { readPresentationMeta } from "./presentation-meta.js"
import { canonicalStyles, engineStyles } from "./native-formatting-styles.js"
import { canonicalProps, engineProps } from "./native-formatting-props.js"
import {
  effectiveInline,
  effectiveParagraph,
} from "./native-formatting-render-values.js"

function common<T>(values: T[]): T | null {
  const first = values[0]
  return first !== undefined && values.every((v) => v === first) ? first : null
}

function selectedParagraphs(view: EditorView) {
  const { selection, doc } = view.state
  const paragraphs: { node: Node; pos: number }[] = []
  if (selection.empty) {
    for (let depth = selection.$from.depth; depth > 0; depth--) {
      const node = selection.$from.node(depth)
      if (node.isTextblock) {
        paragraphs.push({ node, pos: selection.$from.before(depth) })
        break
      }
    }
  } else {
    doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.isTextblock) paragraphs.push({ node, pos })
    })
  }
  return paragraphs
}

export function flowFormatting(binding: FlowBinding, view: EditorView) {
  const dispatch = (tr: typeof view.state.tr) => {
    yUndoPluginKey.getState(view.state)?.undoManager.stopCapturing()
    view.dispatch(tr)
    yUndoPluginKey.getState(view.state)?.undoManager.stopCapturing()
  }
  return {
    formatInline(input: {
      color?: string | null
      highlight?: string | null
      fontId?: string | null
      size?: number | null
    }) {
      const patch = inlinePatchSchema.parse(input)
      if (patch.size != null && patch.size % 10 !== 0)
        throw new Error("Paper text size must use half points")
      const { state } = view
      if (!selectedParagraphs(view).length) return
      const tr = state.tr
      for (const [key, value] of Object.entries(patch)) {
        const mark = state.schema.marks[key]
        if (!mark) throw new Error("Unsupported Paper formatting")
        if (state.selection.empty) tr.removeStoredMark(mark)
        else tr.removeMark(state.selection.from, state.selection.to, mark)
        if (value !== null) {
          const encoded = engineStyles(inlineSchema.parse({ [key]: value }))
          const next = mark.create({ stringValue: Object.values(encoded)[0] })
          if (state.selection.empty) tr.addStoredMark(next)
          else tr.addMark(state.selection.from, state.selection.to, next)
        }
      }
      dispatch(tr)
    },
    formatParagraph(input: {
      alignment?: "left" | "center" | "right" | "justify"
      lineSpacing?: { kind: "multiple"; value: number }
      start?: number
      indent?: { kind: "firstline" | "hanging"; value: number }
    }) {
      const patch = engineProps(paragraphSchema.parse(input))
      const tr = view.state.tr
      for (const { node, pos } of selectedParagraphs(view))
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch })
      if (tr.docChanged) dispatch(tr)
    },
    adjustIndent(delta: 360 | -360) {
      const presentation = readPresentationMeta(binding.doc)
      const tr = view.state.tr
      for (const { node, pos } of selectedParagraphs(view)) {
        const current = effectiveParagraph(
          presentation,
          canonicalProps(node.attrs)
        )
        const hanging =
          current.indent?.kind === "hanging" ? current.indent.value : 0
        const start = Math.max(current.start ?? 0, hanging)
        const next = Math.max(0, Math.min(2880, start + delta))
        const patch = engineProps(
          paragraphSchema.parse({
            start: next,
            ...(hanging > next
              ? { indent: { kind: "hanging", value: next } }
              : {}),
          })
        )
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch })
      }
      if (tr.docChanged) dispatch(tr)
    },
    activeFormatting() {
      const presentation = readPresentationMeta(binding.doc)
      const inlines: InlinePresentation[] = []
      const readMarks = (marks: readonly Mark[], node: Node) => {
        const direct = canonicalStyles(
          Object.fromEntries(
            marks
              .filter((mark) => mark.type.name !== "link")
              .map((mark) => [mark.type.name, mark.attrs.stringValue])
          )
        )
        const inherited = effectiveInline(presentation, {
          ...paragraphInlineValues(
            effectiveParagraphStyle(
              node.type.name,
              canonicalProps(node.attrs).paragraphStyle,
              node.attrs.level
            )
          ),
          ...direct,
        })
        return {
          ...inherited,
          ...effectiveRunDecorations(
            direct,
            marks.some((mark) => mark.type.name === "link"),
            inherited
          ),
        }
      }
      const { selection, doc, storedMarks } = view.state
      if (selection.empty)
        inlines.push(
          readMarks(
            storedMarks ?? selection.$from.marks(),
            selection.$from.parent
          )
        )
      else
        doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (node.isText)
            inlines.push(readMarks(node.marks, doc.resolve(pos).parent))
        })
      if (!inlines.length && selectedParagraphs(view).length)
        inlines.push(readMarks(selection.$from.marks(), selection.$from.parent))
      const paragraphs = selectedParagraphs(view).map(({ node }) =>
        effectiveParagraph(presentation, canonicalProps(node.attrs))
      )
      return {
        hasText: paragraphs.length > 0,
        bold: common(inlines.map((v) => v.bold ?? false)),
        italic: common(inlines.map((v) => v.italic ?? false)),
        underline: common(inlines.map((v) => v.underline ?? false)),
        strike: common(inlines.map((v) => v.strike ?? false)),
        color: common(inlines.map((v) => v.color ?? "#000000")),
        highlight: common(inlines.map((v) => v.highlight ?? "default")),
        fontId: common(inlines.map((v) => v.fontId ?? "liberation-sans")),
        size: common(inlines.map((v) => String((v.size ?? 220) / 20))),
        alignment: common(paragraphs.map((v) => v.alignment ?? "left")),
        lineSpacing: common(
          paragraphs.map((v) =>
            v.lineSpacing
              ? v.lineSpacing.kind === "multiple"
                ? String(v.lineSpacing.value)
                : `${v.lineSpacing.value / 20} pt${v.lineSpacing.kind === "atleast" ? " minimum" : " exact"}`
              : "1.2"
          )
        ),
        start: common(paragraphs.map((v) => String((v.start ?? 0) / 1440))),
        indent: common(
          paragraphs.map((v) =>
            v.indent ? `${v.indent.kind}:${v.indent.value}` : "firstline:0"
          )
        ),
      }
    },
  }
}
