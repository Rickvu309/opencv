import { richEditorCommands } from "./native-formatting-commands.js"
import { isSafeHref } from "@workspace/domain"
import { BlockNoteEditor, createExtension } from "@blocknote/core"
import { CollaborationExtension } from "@blocknote/core/yjs"
import { Plugin } from "@tiptap/pm/state"
import {
  inlineSchema,
  effectiveRunDecorations,
  paragraphInlineValues,
  effectiveParagraphStyle,
  type InlinePresentation,
} from "@workspace/domain/internal/paper-presentation"
import {
  nativeLayoutSchema,
  type PrivateLayoutEditor,
} from "./native-layout-schema.js"
import { readFlow, type FlowBinding } from "./native-layout-flow.js"
import { readPresentationMeta } from "./presentation-meta.js"
import { layoutCellAt } from "./native-layout-transaction.js"
import { acceptsFlowTransaction } from "./native-layout-flow-transaction.js"
import {
  flowDecorations,
  flowPaginationSupport,
  installFlowView,
} from "./native-layout-flow-view.js"
import { editableTarget } from "./native-layout-mount.js"
import {
  pasteIntoFlowText,
  pasteIntoLayoutCell,
} from "./native-layout-paste.js"
import {
  setPhotoResolver,
  type PhotoUrlResolver,
} from "./native-photo-render.js"
import { canonicalStyles, engineStyles } from "./native-formatting-styles.js"
import { effectiveInline } from "./native-formatting-render-values.js"
import { flowPhotoControls } from "./native-layout-photo-controls.js"

import { photoSelection } from "./native-photo-selection.js"
import { flowFormatting } from "./native-layout-formatting.js"

const mounted = new WeakMap<FlowBinding, PrivateLayoutEditor>()
export function mountPrivateFlow(
  binding: FlowBinding,
  element: HTMLElement,
  resolvePhoto?: PhotoUrlResolver
) {
  readFlow(binding)
  if (mounted.has(binding)) throw new Error("Layout binding is already mounted")
  let breaks = new Map<string, number>()
  const guard = createExtension({
    key: "paperFlowAdmission",
    prosemirrorPlugins: [
      new Plugin({
        filterTransaction: (tr, state) =>
          acceptsFlowTransaction(binding, tr, state),
        props: {
          decorations: (state) =>
            flowDecorations(
              state.doc,
              readPresentationMeta(binding.doc),
              flowPaginationSupport(readFlow(binding)).supported,
              breaks
            ),
        },
      }),
    ],
  })
  const editor = BlockNoteEditor.create({
    schema: nativeLayoutSchema,
    trailingBlock: false,
    links: {
      isValidLink: isSafeHref,
      HTMLAttributes: { style: "text-decoration:none;color:inherit" },
    },
    pasteHandler: ({ event, editor, defaultPasteHandler }) =>
      pasteIntoLayoutCell(editor, event) ||
      pasteIntoFlowText(editor, event) ||
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
  setPhotoResolver(editor, resolvePhoto)
  const selection = photoSelection(element)
  let active = true
  let flowView: ReturnType<typeof installFlowView> | undefined
  const setInline = (input: InlinePresentation) => {
    if (!active) throw new Error("Layout view is unmounted")
    editor.addStyles(engineStyles(inlineSchema.parse(input)))
  }
  const activeInline = () => {
    const block = editor.getTextCursorPosition().block
    const props = block.props
    const style = "paragraphStyle" in props ? props.paragraphStyle : undefined
    const direct = canonicalStyles(editor.getActiveStyles())
    const effective = effectiveInline(readPresentationMeta(binding.doc), {
      ...paragraphInlineValues(
        effectiveParagraphStyle(
          block.type,
          style,
          "level" in props ? props.level : undefined
        )
      ),
      ...direct,
    })
    return {
      ...effective,
      ...effectiveRunDecorations(
        direct,
        Boolean(editor.getSelectedLinkUrl()),
        effective
      ),
    }
  }
  const keydown = (event: KeyboardEvent) => {
    if (
      event.key === "Tab" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      if (
        ["bulletListItem", "numberedListItem"].includes(
          editor.getTextCursorPosition().block.type
        )
      )
        return
      const cellId = layoutCellAt(editor.prosemirrorState.selection.$from)
      if (!cellId) return
      const doc = readFlow(binding)
      const tables = doc.flow.children
        .flatMap((section) => section.children)
        .flatMap((node) => (node.type === "table" ? [node] : []))
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
        const siblings = doc.flow.children
          .flatMap((section) => section.children)
          .filter((node) => node.type !== "pageBreak")
        const tableIndex = siblings.findIndex((node) => node.id === table.id)
        const neighbors = event.shiftKey
          ? siblings.slice(0, tableIndex).reverse()
          : siblings.slice(tableIndex + 1)
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
  }

  const refresh = () => {
    if (active) {
      editor.prosemirrorView.dispatch(editor.prosemirrorState.tr)
      selection.paint()
      flowView?.schedule()
    }
  }
  try {
    editor.mount(element)
    flowView = installFlowView(
      element,
      () => readFlow(binding),
      (next) => {
        if (
          next.size === breaks.size &&
          [...next].every(([id, height]) => breaks.get(id) === height)
        )
          return
        breaks = next
        editor.prosemirrorView.dispatch(editor.prosemirrorState.tr)
      }
    )
    editor.onChange(() => {
      selection.paint()
      flowView?.schedule()
    })
    mounted.set(binding, editor)
    element.addEventListener("keydown", keydown, true)
    binding.doc.getMap("paper").observeDeep(refresh)
  } catch (error) {
    selection.destroy()
    flowView?.destroy()
    editor._tiptapEditor.destroy()
    throw error
  }
  const commands = richEditorCommands(editor, (mark) =>
    setInline({ [mark]: !activeInline()[mark] })
  )
  return {
    commands,
    editor,
    photoControls: { ...flowPhotoControls(binding, editor), ...selection },
    ...flowFormatting(binding, editor.prosemirrorView),
    setInline,
    activeInline,
    pagination: () => flowPaginationSupport(readFlow(binding)),
    unmount() {
      if (!active) return
      active = false
      selection.destroy()
      commands.destroy()
      binding.doc.getMap("paper").unobserveDeep(refresh)
      element.removeEventListener("keydown", keydown, true)
      flowView?.destroy()
      mounted.delete(binding)
      editor._tiptapEditor.destroy()
    },
  }
}
