import type { Node } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  effectiveRunDecorations,
  effectiveParagraphStyle,
  type DocumentPresentation,
} from "@workspace/domain/internal/paper-presentation"
import { canonicalStyles } from "./native-formatting-styles.js"
import { canonicalProps } from "./native-formatting-props.js"
import {
  effectiveInline,
  effectiveParagraph,
  inlineCss,
  paragraphCss,
} from "./native-formatting-render-values.js"

function listPresentation(doc: Node, pos: number, type: string) {
  if (type !== "bulletListItem" && type !== "numberedListItem") return {}
  const point = doc.resolve(pos)
  let level = 0
  for (let depth = 1; depth < point.depth; depth++) {
    const ancestor = point.node(depth)
    if (
      ancestor.type.name === "blockContainer" &&
      ["bulletListItem", "numberedListItem"].includes(
        ancestor.firstChild?.type.name ?? ""
      )
    )
      level++
  }
  let number = 1
  const group = point.node(point.depth - 1)
  for (let index = point.index(point.depth - 1) - 1; index >= 0; index--) {
    if (group.child(index).firstChild?.type.name !== "numberedListItem") break
    number++
  }
  const marker = type === "bulletListItem" ? "•" : `${number}.`
  return {
    style: `display:list-item;list-style-type:"${marker} ";margin-inline-start:${(level + 1) * 24}pt`,
    role: "listitem",
    "aria-level": String(level + 1),
  }
}

export function formattingDecorations(
  doc: Node,
  presentation: DocumentPresentation
) {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.isText) {
      const marks = Object.fromEntries(
        node.marks
          .filter((mark) => mark.type.name !== "link")
          .map((mark) => [mark.type.name, mark.attrs.stringValue])
      )
      const isLink = node.marks.some((mark) => mark.type.name === "link")
      const direct = canonicalStyles(marks)
      const effective = effectiveInline(
        presentation,
        direct,
        effectiveParagraphStyle(
          doc.resolve(pos).parent.type.name,
          doc.resolve(pos).parent.attrs.paragraphStyle,
          doc.resolve(pos).parent.attrs.level
        )
      )
      const runDecorations = effectiveRunDecorations(direct, isLink, effective)
      const line = effectiveParagraph(
        presentation,
        canonicalProps(doc.resolve(pos).parent.attrs)
      ).lineSpacing
      decorations.push(
        Decoration.inline(pos, pos + node.nodeSize, {
          style: inlineCss({ ...effective, ...runDecorations }, line),
          "data-paper-resolved": "",
        })
      )
    } else if (node.isTextblock) {
      const list = listPresentation(doc, pos, node.type.name)
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          ...list,
          style:
            paragraphCss(
              effectiveParagraph(presentation, canonicalProps(node.attrs))
            ) +
            ";" +
            (list.style ?? ""),
        })
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}
