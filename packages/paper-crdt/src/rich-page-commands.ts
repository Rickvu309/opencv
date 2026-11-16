import { docToBlocks } from "@blocknote/core"
import { TextSelection } from "@tiptap/pm/state"
import { yUndoPluginKey } from "y-prosemirror"
import {
  documentPresentationSchema,
  type FlowDocument,
} from "@workspace/domain/internal/paper-presentation"
import {
  commitFlowPageDocument,
  readFlow,
  type FlowBinding,
} from "./native-layout-flow.js"
import { readFlowBlocks } from "./native-layout-flow-codec.js"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"

type Page = FlowDocument["presentation"]["page"]
type PageSetup = {
  [Key in keyof Page]: Page[Key] extends number ? number : Page[Key]
}

export function richPageCommands(
  binding: FlowBinding,
  editor: PrivateLayoutEditor
) {
  const view = editor.prosemirrorView
  const history = yUndoPluginKey.getState(view.state)?.undoManager
  if (!history) throw new Error("Page editing needs document history")
  history.addTrackedOrigin("private-flow-page")
  history.addToScope(binding.doc.getMap("paper"))
  const change = (document: FlowDocument) => {
    if (!editor.isEditable) throw new Error("Paper is not ready for editing")
    history.stopCapturing()
    const result = commitFlowPageDocument(binding, document)
    history.stopCapturing()
    if (result.kind === "refused") throw new Error(result.reason)
  }
  const commands = {
    pageSetup: () => readFlow(binding).presentation.page,
    setPageSetup(value: PageSetup) {
      const page = documentPresentationSchema.shape.page.parse(value)
      const document = readFlow(binding)
      document.presentation.page = page
      for (const section of document.flow.children) section.page = page
      change(document)
    },
    canInsertPageBreak() {
      const { $from, $to } = view.state.selection
      return (
        editor.isEditable && $from.sameParent($to) && $from.parent.isTextblock
      )
    },
    insertPageBreak() {
      if (!commands.canInsertPageBreak()) return false
      const state = view.state
      const tr = state.tr.deleteSelection()
      const point = tr.selection.$from
      let depth = point.depth
      while (depth > 0 && point.node(depth).type.name !== "blockContainer")
        depth--
      if (!depth) return false
      let sectionChild = depth
      for (let d = depth; d > 1; d--)
        if (
          point.node(d - 1).type.name === "blockGroup" &&
          point.node(d - 2).firstChild?.type.name === "paperFlowSection"
        ) {
          sectionChild = d
          break
        }
      const container = state.schema.nodes.blockContainer
      const pageBreak = state.schema.nodes.paperPageBreak
      const paragraph = state.schema.nodes.paragraph
      if (!container || !pageBreak || !paragraph) return false
      const breakId = crypto.randomUUID()
      const breakNode = container.create({ id: breakId }, pageBreak.create())
      let insertAt: number
      if (
        sectionChild === depth &&
        point.parent.isTextblock &&
        point.depth === depth + 1
      ) {
        const newId = crypto.randomUUID()
        tr.split(point.pos, 2, [
          { type: container, attrs: { ...point.node(depth).attrs, id: newId } },
          { type: point.parent.type, attrs: point.parent.attrs },
        ])
        insertAt = tr.selection.$from.before(depth)
        tr.insert(insertAt, breakNode)
      } else {
        insertAt = point.after(sectionChild)
        tr.insert(insertAt, [
          breakNode,
          container.create({ id: crypto.randomUUID() }, paragraph.create()),
        ])
      }
      const document = readFlowBlocks(
        docToBlocks(tr.doc),
        binding.kind,
        readFlow(binding).presentation
      )
      change(document)
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.near(
            view.state.doc.resolve(insertAt + breakNode.nodeSize + 2)
          )
        )
      )
      view.focus()
      return true
    },
    removePageBreak(backward: boolean) {
      const { selection, doc } = view.state
      if (!selection.empty || !selection.$from.parent.isTextblock) return false
      const point = selection.$from
      if (
        backward
          ? point.parentOffset !== 0
          : point.parentOffset !== point.parent.content.size
      )
        return false
      const boundary = backward
        ? point.before(point.depth - 1)
        : point.after(point.depth - 1)
      const adjacent = backward
        ? doc.resolve(boundary).nodeBefore
        : doc.resolve(boundary).nodeAfter
      if (adjacent?.firstChild?.type.name !== "paperPageBreak") return false
      const document = readFlow(binding)
      for (const section of document.flow.children)
        section.children = section.children.filter(
          (node) => node.id !== adjacent.attrs.id
        )
      change(document)
      return true
    },
  }
  return commands
}
