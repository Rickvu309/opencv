import { BlockNoteEditor, createExtension } from "@blocknote/core"
import { CollaborationExtension } from "@blocknote/core/yjs"
import { Plugin } from "@tiptap/pm/state"
import {
  inlineSchema,
  type InlinePresentation,
  type FormatNode,
  type LayoutTable,
  type LayoutRow,
  type LayoutCell,
} from "@workspace/domain/internal/paper-presentation"
import {
  nativeLayoutSchema,
  type PrivateLayoutEditor,
} from "./native-layout-schema.js"
import { readLayout, type LayoutBinding } from "./native-layout.js"
import { readPresentationMeta } from "./presentation-meta.js"
import {
  acceptsLayoutTransaction,
  layoutCellAt,
} from "./native-layout-transaction.js"
import { layoutDecorations } from "./native-layout-decorations.js"
import { pasteIntoLayoutCell } from "./native-layout-paste.js"
import { canonicalStyles, engineStyles } from "./native-formatting-styles.js"
import { effectiveInline } from "./native-formatting-render-values.js"

const mounted = new WeakMap<LayoutBinding, PrivateLayoutEditor>()
function editableTarget(
  node: FormatNode | LayoutTable | LayoutRow | LayoutCell,
  reverse: boolean
): string | undefined {
  if ("content" in node) return node.id
  if (!("children" in node)) return undefined
  const children = reverse ? [...node.children].reverse() : node.children
  for (const child of children) {
    const target = editableTarget(child, reverse)
    if (target) return target
  }
  return undefined
}
export function mountPrivateLayout(
  binding: LayoutBinding,
  element: HTMLElement
) {
  readLayout(binding)
  if (mounted.has(binding)) throw new Error("Layout binding is already mounted")
  const guard = createExtension({
    key: "paperLayout",
    prosemirrorPlugins: [
      new Plugin({
        filterTransaction: (tr, state) =>
          acceptsLayoutTransaction(binding, tr, state),
        props: {
          decorations: (state) =>
            layoutDecorations(state.doc, readPresentationMeta(binding.doc)),
        },
      }),
    ],
  })
  const editor = BlockNoteEditor.create({
    schema: nativeLayoutSchema,
    trailingBlock: false,
    links: { HTMLAttributes: { style: "text-decoration:none;color:inherit" } },
    pasteHandler: ({ event, editor, defaultPasteHandler }) =>
      pasteIntoLayoutCell(editor, event) ||
      defaultPasteHandler({
        prioritizeMarkdownOverHTML: false,
        plainTextAsMarkdown: false,
      }),
    extensions: [
      CollaborationExtension({
        fragment: binding.fragment,
        user: { name: "You", color: "#555555" },
      }),
      guard,
    ],
  })
  let active = true
  const setInline = (input: InlinePresentation) => {
    if (!active) throw new Error("Layout view is unmounted")
    editor.addStyles(engineStyles(inlineSchema.parse(input)))
  }
  const keydown = (event: KeyboardEvent) => {
    if (
      event.key === "Tab" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const cellId = layoutCellAt(editor.prosemirrorState.selection.$from)
      if (!cellId) return
      const doc = readLayout(binding)
      const tables = doc.flow.children.filter((node) => node.type === "table")
      const table = tables.find((node) =>
        node.children.some((row) =>
          row.children.some((cell) => cell.id === cellId)
        )
      )
      if (!table) return
      event.stopImmediatePropagation()
      const cells = table.children.flatMap((row) => row.children),
        index = cells.findIndex((cell) => cell.id === cellId)
      const next = cells[index + (event.shiftKey ? -1 : 1)]
      let target = next && editableTarget(next, false)
      if (!target) {
        const tableIndex = doc.flow.children.findIndex(
          (node) => node.id === table.id
        )
        const neighbors = event.shiftKey
          ? doc.flow.children.slice(0, tableIndex).reverse()
          : doc.flow.children.slice(tableIndex + 1)
        for (const neighbor of neighbors) {
          target = editableTarget(neighbor, event.shiftKey)
          if (target) break
        }
      }
      if (!target) return
      event.preventDefault()
      editor.setTextCursorPosition(
        target,
        !next && event.shiftKey ? "end" : "start"
      )
      editor.focus()
      return
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    const key = event.key.toLowerCase()
    const mark =
      key === "b"
        ? "bold"
        : key === "i"
          ? "italic"
          : key === "u"
            ? "underline"
            : key === "x" && event.shiftKey
              ? "strike"
              : undefined
    if (!mark) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const effective = effectiveInline(
      readPresentationMeta(binding.doc),
      canonicalStyles(editor.getActiveStyles())
    )
    setInline({ [mark]: !effective[mark] })
  }
  const refresh = () => {
    if (active) editor.prosemirrorView.dispatch(editor.prosemirrorState.tr)
  }
  try {
    editor.mount(element)
    mounted.set(binding, editor)
    element.addEventListener("keydown", keydown, true)
    binding.doc.getMap("paper").observeDeep(refresh)
  } catch (error) {
    editor._tiptapEditor.destroy()
    throw error
  }
  return {
    editor,
    setInline,
    unmount() {
      if (!active) return
      active = false
      binding.doc.getMap("paper").unobserveDeep(refresh)
      element.removeEventListener("keydown", keydown, true)
      mounted.delete(binding)
      editor._tiptapEditor.destroy()
    },
  }
}
