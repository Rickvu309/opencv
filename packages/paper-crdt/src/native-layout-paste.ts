import { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import { Fragment, type Node } from "@tiptap/pm/model"
import DOMPurify from "dompurify"
import { layoutCellAt } from "./native-layout-transaction.js"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"

export function pasteIntoLayoutCell(
  editor: PrivateLayoutEditor,
  event: ClipboardEvent
): boolean {
  const state = editor.prosemirrorState,
    { $from, $to } = state.selection
  if (!layoutCellAt($from)) return false
  if (
    layoutCellAt($from) !== layoutCellAt($to) ||
    $from.parent.type.name !== "paragraph" ||
    $to.parent.type.name !== "paragraph" ||
    $from.node($from.depth - 2).type.name !== "paperCell" ||
    $to.node($to.depth - 2).type.name !== "paperCell"
  )
    return true
  const html = DOMPurify.sanitize(
      event.clipboardData?.getData("text/html") ?? "",
      { USE_PROFILES: { html: true } }
    ),
    plain = event.clipboardData?.getData("text/plain")
  if (!html && plain === undefined) return true
  try {
    if (html) {
      const parsed = new DOMParser().parseFromString(html, "text/html")
      if (parsed.querySelector("table,img,video,audio,iframe,object"))
        return true
    }
    const blocks = html
      ? editor.tryParseHTMLToBlocks(html)
      : (plain ?? "")
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((text) => ({
            type: "paragraph" as const,
            content: text
              ? [
                  {
                    type: "text" as const,
                    text,
                    styles: editor.getActiveStyles(),
                  },
                ]
              : [],
          }))
    const parsed = _blocksToProsemirrorNode(editor, blocks),
      group = parsed.firstChild
    if (!group || !group.childCount) return true
    const nodes: Node[] = []
    group.forEach((node) => nodes.push(node))
    if (nodes.some((node) => node.type.name !== "blockContainer")) return true
    const prefix = $from.parent.content.cut(0, $from.parentOffset),
      suffix = $to.parent.content.cut($to.parentOffset)
    const first = nodes[0],
      last = nodes.at(-1)
    if (!first || !last || !first.firstChild || !last.firstChild) return true
    if (first.firstChild.type.name === "paragraph") {
      nodes[0] = first.type.create(
        { ...first.attrs, id: $from.node($from.depth - 1).attrs.id },
        Fragment.from(
          first.firstChild.copy(prefix.append(first.firstChild.content))
        ).append(first.content.cut(first.firstChild.nodeSize))
      )
    } else if (prefix.size) {
      nodes.unshift(
        $from
          .node($from.depth - 1)
          .type.create(
            $from.node($from.depth - 1).attrs,
            $from.parent.copy(prefix)
          )
      )
    }
    const end = nodes.at(-1)
    if (!end?.firstChild) return true
    if (end.firstChild.type.name === "paragraph") {
      nodes[nodes.length - 1] = end.type.create(
        end.attrs,
        Fragment.from(
          end.firstChild.copy(end.firstChild.content.append(suffix))
        ).append(end.content.cut(end.firstChild.nodeSize))
      )
    } else if (suffix.size) {
      nodes.push(
        $to.node($to.depth - 1).type.create(
          {
            ...$to.node($to.depth - 1).attrs,
            id:
              $from.node($from.depth - 1).attrs.id ===
              $to.node($to.depth - 1).attrs.id
                ? crypto.randomUUID()
                : $to.node($to.depth - 1).attrs.id,
          },
          $to.parent.copy(suffix)
        )
      )
    }
    editor.prosemirrorView.dispatch(
      state.tr
        .replaceWith(
          $from.before($from.depth - 1),
          $to.after($to.depth - 1),
          Fragment.fromArray(nodes)
        )
        .scrollIntoView()
    )
  } catch {
    return true
  }
  return true
}
