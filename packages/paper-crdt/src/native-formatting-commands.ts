import { isSafeHref } from "@workspace/domain"
import {
  paperParagraphStyle,
  paperParagraphStyles,
  type PaperParagraphStyle,
} from "@workspace/domain/internal/paper-presentation"
import { yUndoPluginKey } from "y-prosemirror"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"
import { formattingProps } from "./native-formatting-props.js"

const textTypes = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "paperCvField",
])
type ListType = "bulletListItem" | "numberedListItem"

export function richEditorCommands(
  editor: PrivateLayoutEditor,
  toggleMark: (mark: "bold" | "italic" | "underline" | "strike") => void
) {
  const view = editor.prosemirrorView
  const history = () => yUndoPluginKey.getState(view.state)?.undoManager
  const change = (action: () => void) => {
    if (!editor.isEditable) return
    history()?.stopCapturing()
    action()
    history()?.stopCapturing()
    view.focus()
  }
  const textBlocks = () => {
    const blocks: {
      pos: number
      type: string
      attrs: Record<string, unknown>
    }[] = []
    const { from, to } = view.state.selection
    view.state.doc.nodesBetween(from, to, (node, pos) => {
      if (textTypes.has(node.type.name))
        blocks.push({ pos, type: node.type.name, attrs: node.attrs })
    })
    return blocks
  }
  const setParagraphStyle = (style: PaperParagraphStyle) =>
    change(() => {
      const tr = view.state.tr
      for (const block of textBlocks()) {
        const type =
          block.type === "heading"
            ? view.state.schema.nodes.paragraph
            : undefined
        tr.setNodeMarkup(block.pos, type, {
          ...block.attrs,
          paragraphStyle: style,
        })
      }
      view.dispatch(tr)
    })
  const toggleList = (type: ListType) =>
    change(() => {
      const blocks = textBlocks().filter(
        (block) => block.type !== "paperCvField"
      )
      const target = blocks.every((block) => block.type === type)
        ? "paragraph"
        : type
      const tr = view.state.tr
      for (const block of blocks)
        tr.setNodeMarkup(
          block.pos,
          view.state.schema.nodes[target],
          block.attrs
        )
      view.dispatch(tr)
    })
  const listLevel = (direction: "in" | "out") =>
    change(() => {
      const block = editor.getTextCursorPosition().block
      if (block.type !== "bulletListItem" && block.type !== "numberedListItem")
        return
      if (direction === "in" && editor.canNestBlock()) editor.nestBlock()
      if (direction === "out" && editor.canUnnestBlock()) editor.unnestBlock()
    })
  const linkRange = () => {
    const { from, to, empty } = view.state.selection
    const link = editor.getLinkMarkAtPos(from)
    return empty && link ? { from: link.from, to: link.to } : { from, to }
  }
  const setLink = (href: string) => {
    if (!editor.isEditable || !isSafeHref(href)) return false
    const { from, to } = linkRange()
    const mark = view.state.schema.marks.link
    if (!mark || from === to) return false
    change(() =>
      view.dispatch(view.state.tr.addMark(from, to, mark.create({ href })))
    )
    return true
  }
  const removeLink = () =>
    change(() => {
      const { from, to } = linkRange()
      const mark = view.state.schema.marks.link
      if (mark)
        view.dispatch(
          view.state.tr.removeMark(from, to, mark).removeStoredMark(mark)
        )
    })
  const clearFormatting = () =>
    change(() => {
      const { from, to } = view.state.selection
      const tr = view.state.tr.removeMark(from, to).setStoredMarks([])
      for (const block of textBlocks()) {
        const props = Object.fromEntries(
          Object.keys(formattingProps).map((key) => [key, undefined])
        )
        tr.setNodeMarkup(
          block.pos,
          block.type === "heading"
            ? view.state.schema.nodes.paragraph
            : undefined,
          { ...block.attrs, ...props, paragraphStyle: "normal" }
        )
      }
      view.dispatch(tr)
    })
  const undo = () => {
    if (editor.isEditable) {
      editor.undo()
      view.focus()
    }
  }
  const redo = () => {
    if (editor.isEditable) {
      editor.redo()
      view.focus()
    }
  }
  const keydown = (event: KeyboardEvent) => {
    if (!editor.isEditable) return
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    let action: (() => void) | undefined
    if (mod && key === "z") action = event.shiftKey ? redo : undo
    if (mod && key === "y") action = redo
    if (
      mod &&
      !event.altKey &&
      !event.shiftKey &&
      ["b", "i", "u"].includes(key)
    ) {
      const mark = key === "b" ? "bold" : key === "i" ? "italic" : "underline"
      action = () => change(() => toggleMark(mark))
    }
    if (mod && event.shiftKey && event.code === "Digit5")
      action = () => change(() => toggleMark("strike"))
    if (mod && key === "\\") action = clearFormatting
    if (mod && event.shiftKey && event.code === "Digit7")
      action = () => toggleList("numberedListItem")
    if (mod && event.shiftKey && event.code === "Digit8")
      action = () => toggleList("bulletListItem")
    if (mod && !event.shiftKey && key === "k")
      action = () =>
        view.dom.dispatchEvent(new Event("paper-edit-link", { bubbles: true }))
    if (mod && event.altKey && /^Digit[0-3]$/.test(event.code)) {
      const level = Number(event.code.slice(-1))
      const style = paperParagraphStyles.find(
        (item) => item.id === (level === 0 ? "normal" : `heading-${level}`)
      )
      if (style) action = () => setParagraphStyle(style.id)
    }
    if (!mod && key === "tab") {
      const type = editor.getTextCursorPosition().block.type
      if (type === "bulletListItem" || type === "numberedListItem")
        action = () => listLevel(event.shiftKey ? "out" : "in")
    }
    if (!action) return
    event.preventDefault()
    event.stopImmediatePropagation()
    action()
  }
  view.dom.addEventListener("keydown", keydown, true)
  return {
    setParagraphStyle,
    toggleList,
    listLevel,
    setLink,
    removeLink,
    clearFormatting,
    undo,
    redo,
    toggleMark: (mark: "bold" | "italic" | "underline" | "strike") =>
      change(() => toggleMark(mark)),
    formattingState() {
      const blocks = textBlocks()
      const style = blocks[0]?.attrs.paragraphStyle
      return {
        paragraphStyle:
          paperParagraphStyle(typeof style === "string" ? style : undefined)
            ?.id ?? "normal",
        mixedStyle: blocks.some(
          (block) =>
            (block.attrs.paragraphStyle ?? "normal") !== (style ?? "normal")
        ),
        list: blocks[0]?.type,
        href: editor.getSelectedLinkUrl() ?? "",
        canLink:
          !view.state.selection.empty || Boolean(editor.getSelectedLinkUrl()),
        canUndo: Boolean(history()?.undoStack.length),
        canRedo: Boolean(history()?.redoStack.length),
        canIndent:
          ["bulletListItem", "numberedListItem"].includes(
            editor.getTextCursorPosition().block.type
          ) && editor.canNestBlock(),
        canOutdent:
          ["bulletListItem", "numberedListItem"].includes(
            editor.getTextCursorPosition().block.type
          ) && editor.canUnnestBlock(),
      }
    },
    paragraphStyles: paperParagraphStyles,
    destroy() {
      view.dom.removeEventListener("keydown", keydown, true)
    },
  }
}
