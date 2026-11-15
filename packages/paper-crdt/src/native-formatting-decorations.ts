import type { Node } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { DocumentPresentation } from "@workspace/domain/internal/paper-presentation"
import { canonicalStyles } from "./native-formatting-styles.js"
import { canonicalProps } from "./native-formatting-props.js"
import {
  effectiveInline,
  effectiveParagraph,
  inlineCss,
  paragraphCss,
} from "./native-formatting-render-values.js"

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
      decorations.push(
        Decoration.inline(pos, pos + node.nodeSize, {
          style: inlineCss(
            effectiveInline(presentation, canonicalStyles(marks))
          ),
          "data-paper-resolved": "",
        })
      )
    } else if (node.isTextblock) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          style: paragraphCss(
            effectiveParagraph(presentation, canonicalProps(node.attrs))
          ),
        })
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}
