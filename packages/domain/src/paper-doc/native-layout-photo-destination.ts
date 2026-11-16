import type { FlowDocument } from "./native-layout-flow.js"

export function photoDestination(document: FlowDocument, cursor: string) {
  for (const section of document.flow.children) {
    const width = Math.floor(
      (section.page.width -
        section.page.start -
        section.page.end -
        (section.columns.count - 1) * section.columns.gap) /
        section.columns.count
    )
    for (const node of section.children) {
      if (node.type === "table") {
        for (const row of node.children) {
          for (const cell of row.children) {
            const anchor = cell.children.find(
              (child) =>
                child.id === cursor ||
                ("children" in child &&
                  child.children.some((field) => field.id === cursor))
            )
            if (!anchor) continue
            const column = node.columns.find(
              (column) => column.id === cell.columnId
            )
            if (!column) throw new Error("Photo table column is missing")
            return {
              parentId: cell.id,
              afterId: anchor.id,
              width: Math.min(width, column.width - 240),
            }
          }
        }
      }
      if (
        node.id === cursor ||
        (node.type !== "table" &&
          "children" in node &&
          node.children.some((child) => child.id === cursor))
      )
        return { parentId: section.id, afterId: node.id, width }
    }
  }
  throw new Error("Place the cursor in the document before inserting a photo")
}
