import { nodeIdSchema } from "./nodes.js"
import { flowDocumentSchema } from "./native-layout-flow.js"
import { layoutEditSchema, editTable } from "./native-layout-edit.js"
import { photoLayoutTableSchema } from "./native-layout.js"
import { ok, refuse } from "./presentation-values.js"

export function prepareFlowTableEdit(input: unknown, change: unknown) {
  try {
    const document = flowDocumentSchema.parse(input)
    const edit = layoutEditSchema.parse(change)
    const section = document.flow.children.find((section) =>
      section.children.some((node) =>
        edit.kind === "insert-table"
          ? node.id === edit.afterId
          : node.type === "table" && node.id === edit.tableId
      )
    )
    if (!section) throw new Error("Place the cursor in the document")
    const index = section.children.findIndex(
      (node) =>
        node.id === (edit.kind === "insert-table" ? edit.afterId : edit.tableId)
    )
    if (edit.kind === "insert-table") {
      section.children.splice(index + 1, 0, edit.table)
    } else if (edit.kind === "remove-table") {
      section.children.splice(index, 1)
      if (!section.children.length)
        section.children.push({
          id: nodeIdSchema.parse(crypto.randomUUID()),
          type: "paragraph",
          paragraph: {},
          content: [],
        })
    } else {
      const table = photoLayoutTableSchema.parse(section.children[index])
      section.children.splice(index, 1, editTable(table, edit))
    }
    return ok(flowDocumentSchema.parse(document))
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "Table edit refused")
  }
}
