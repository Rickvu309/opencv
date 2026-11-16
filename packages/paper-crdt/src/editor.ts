import type { RichPaperDocument } from "@workspace/domain"
import { TextSelection } from "@tiptap/pm/state"
import type { PaperClient } from "./client.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"

export type RichMark = "bold" | "italic" | "underline" | "strike"

export function mountRichPaperEditor(
  client: PaperClient<RichPaperDocument>,
  element: HTMLElement,
  options: { readonly photoUrl?: (fileId: string) => string | undefined } = {}
) {
  const document = client.document()
  if (!document) throw new Error("Rich Paper document required")
  const lease = borrowFlowDocument(client.ydoc, document.kind)
  let active = true
  let removeRelease = () => {}
  try {
    const mounted = mountPrivateFlow(lease.binding, element, options.photoUrl)
    const view = mounted.editor.prosemirrorView
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
    const destroy = () => {
      if (!active) return
      active = false
      removeRelease()
      mounted.unmount()
      lease.release()
    }
    removeRelease = client.onDocumentRelease(destroy)
    return {
      setEditable(editable: boolean) {
        if (active) mounted.editor.isEditable = editable
      },
      focus() {
        if (active) view.focus()
      },
      toggleMark(mark: RichMark) {
        if (!active) throw new Error("Paper editor is closed")
        mounted.setInline({ [mark]: !mounted.activeInline()[mark] })
        view.focus()
      },
      formatInline(input: Parameters<typeof mounted.formatInline>[0]) {
        if (!active) throw new Error("Paper editor is closed")
        mounted.formatInline(input)
      },
      formatParagraph(input: Parameters<typeof mounted.formatParagraph>[0]) {
        if (!active) throw new Error("Paper editor is closed")
        mounted.formatParagraph(input)
      },
      activeFormatting() {
        if (!active) throw new Error("Paper editor is closed")
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
        const offSelection = mounted.editor.onSelectionChange(listener)
        const offChange = mounted.editor.onChange(listener)
        return () => {
          offSelection()
          offChange()
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
