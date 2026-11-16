import type { RichPaperDocument } from "@workspace/domain"
import { TextSelection } from "@tiptap/pm/state"
import type { PaperClient } from "./client.js"
import {
  richTextColors,
  richTextHighlights,
  richTextFonts,
} from "./formatting-options.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import {
  captureEditorSelection,
  restoreEditorSelection,
} from "./editor-selection.js"

export type RichMark = "bold" | "italic" | "underline" | "strike"

export function mountRichPaperEditor(
  client: PaperClient<RichPaperDocument>,
  element: HTMLElement,
  options: {
    readonly photoUrl?: (fileId: string) => string | undefined
    readonly onRelease?: (
      selection: ReturnType<typeof captureEditorSelection>
    ) => void
  } = {}
) {
  const document = client.document()
  if (!document) throw new Error("Rich Paper document required")
  const lease = borrowFlowDocument(client.ydoc, document.kind)
  let active = true
  let removeRelease = () => {}
  try {
    const mounted = mountPrivateFlow(lease.binding, element, options.photoUrl)
    const commands = mounted.commands
    const view = mounted.editor.prosemirrorView
    const pages = mounted.pages
    if (!view.state.selection.$from.parent.inlineContent) {
      let start: number | undefined
      view.state.doc.descendants((node, position) => {
        if (start !== undefined) return false
        if (node.isTextblock) start = position + 1
        return start === undefined
      })
      if (start !== undefined)
        view.dispatch(
          view.state.tr.setSelection(
            TextSelection.create(view.state.doc, start)
          )
        )
    }
    view.dom.setAttribute("aria-label", "Document content")
    view.dom.style.outline = "none"
    const adjustIndent = (delta: 360 | -360) => {
      const list = commands.formattingState().list
      if (list === "bulletListItem" || list === "numberedListItem")
        commands.listLevel(delta > 0 ? "in" : "out")
      else mounted.adjustIndent(delta)
    }
    const shortcuts = (event: KeyboardEvent) => {
      if (!active || !mounted.editor.isEditable) return
      if (!event.altKey && !event.shiftKey) {
        const handled =
          (event.ctrlKey || event.metaKey) && event.key === "Enter"
            ? pages.insertPageBreak()
            : !event.ctrlKey &&
                !event.metaKey &&
                (event.key === "Backspace" || event.key === "Delete")
              ? pages.removePageBreak(event.key === "Backspace")
              : false
        if (handled) {
          event.preventDefault()
          event.stopImmediatePropagation()
          return
        }
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const alignments = new Map([
        ["l", "left"],
        ["e", "center"],
        ["r", "right"],
        ["j", "justify"],
      ] satisfies [string, "left" | "center" | "right" | "justify"][])
      const alignment = event.shiftKey
        ? alignments.get(event.key.toLowerCase())
        : undefined
      if (alignment) {
        event.preventDefault()
        mounted.formatParagraph({ alignment })
      } else if (!event.shiftKey && (event.key === "[" || event.key === "]")) {
        event.preventDefault()
        adjustIndent(event.key === "]" ? 360 : -360)
      }
    }
    view.dom.addEventListener("keydown", shortcuts, true)
    const destroy = () => {
      if (!active) return
      const selection = captureEditorSelection(view)
      active = false
      removeRelease()
      view.dom.removeEventListener("keydown", shortcuts, true)
      options.onRelease?.(selection)
      mounted.unmount()
      lease.release()
    }
    removeRelease = client.onDocumentRelease(destroy)
    const apply = (action: () => unknown = () => {}) => {
      if (!active || !mounted.editor.isEditable) return false
      if (action() === false) return false
      view.focus()
      return view.dom
    }
    return {
      photos: () => (active ? mounted.photoControls.photos() : []),
      insertPhoto(
        ...args: Parameters<typeof mounted.photoControls.insertPhoto>
      ) {
        if (!active || !mounted.editor.isEditable) return null
        return mounted.photoControls.insertPhoto(...args)
      },
      updatePhoto(
        ...args: Parameters<typeof mounted.photoControls.updatePhoto>
      ) {
        if (active && mounted.editor.isEditable)
          mounted.photoControls.updatePhoto(...args)
      },
      replacePhoto(
        ...args: Parameters<typeof mounted.photoControls.replacePhoto>
      ) {
        if (active && mounted.editor.isEditable)
          mounted.photoControls.replacePhoto(...args)
      },
      removePhoto(
        ...args: Parameters<typeof mounted.photoControls.removePhoto>
      ) {
        if (active && mounted.editor.isEditable)
          mounted.photoControls.removePhoto(...args)
      },
      selectedPhoto: () =>
        active ? mounted.photoControls.selectedPhoto() : null,
      selectPhoto(id: string | null) {
        if (active) mounted.photoControls.selectPhoto(id)
      },
      documentHistory: () =>
        active
          ? mounted.photoControls.documentHistory()
          : { undo: false, redo: false },
      undoDocument: () => apply(commands.undo),
      redoDocument: () => apply(commands.redo),
      ...pages,
      ...mounted.photoControls,
      formattingOptions: {
        colors: richTextColors,
        highlights: richTextHighlights,
        fonts: richTextFonts,
      },
      paragraphStyles: commands.paragraphStyles,
      setParagraphStyle(
        ...args: Parameters<typeof commands.setParagraphStyle>
      ) {
        return apply(() => commands.setParagraphStyle(...args))
      },
      toggleList(...args: Parameters<typeof commands.toggleList>) {
        return apply(() => commands.toggleList(...args))
      },
      listLevel(...args: Parameters<typeof commands.listLevel>) {
        return apply(() => commands.listLevel(...args))
      },
      setLink(...args: Parameters<typeof commands.setLink>) {
        if (!active || !mounted.editor.isEditable) return false
        return commands.setLink(...args)
      },
      removeLink: () => apply(commands.removeLink),
      clearFormatting: () => apply(commands.clearFormatting),
      undo: () => apply(commands.undo),
      redo: () => apply(commands.redo),
      formattingState: () => (active ? commands.formattingState() : null),
      apply,
      setEditable(editable: boolean) {
        if (active) mounted.editor.isEditable = editable
      },
      focus: () => apply(),
      captureSelection() {
        if (active) return captureEditorSelection(view)
      },
      restoreSelection(selection?: ReturnType<typeof captureEditorSelection>) {
        if (active && selection) restoreEditorSelection(view, selection)
      },
      toggleMark(mark: RichMark) {
        if (!active) throw new Error("Paper editor is closed")
        if (!mounted.editor.isEditable) return
        commands.toggleMark(mark)
      },
      formatInline(input: Parameters<typeof mounted.formatInline>[0]) {
        if (!active) throw new Error("Paper editor is closed")
        if (!mounted.editor.isEditable) return
        mounted.formatInline(input)
        view.focus()
      },
      formatParagraph(input: Parameters<typeof mounted.formatParagraph>[0]) {
        if (!active) throw new Error("Paper editor is closed")
        if (!mounted.editor.isEditable) return
        mounted.formatParagraph(input)
        view.focus()
      },
      adjustIndent(delta: 360 | -360) {
        if (!active) throw new Error("Paper editor is closed")
        if (!mounted.editor.isEditable) return
        adjustIndent(delta)
        view.focus()
      },
      activeFormatting() {
        if (!active) return null
        return mounted.activeFormatting()
      },
      activeMarks() {
        if (!active) return {}
        const styles = mounted.activeInline()
        return {
          bold: styles.bold === true,
          italic: styles.italic === true,
          underline: styles.underline === true,
          strike: styles.strike === true,
        }
      },
      subscribe(listener: () => void) {
        if (!active) return () => {}
        const tiptap = mounted.editor._tiptapEditor
        tiptap.on("transaction", listener)
        const offPhoto = mounted.photoControls.subscribePhotoSelection(listener)
        return () => {
          tiptap.off("transaction", listener)
          offPhoto()
        }
      },
      pagination: mounted.pagination,
      destroy,
    }
  } catch (error) {
    lease.release()
    throw error
  }
}
