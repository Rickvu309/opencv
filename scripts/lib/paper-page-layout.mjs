import ts from "typescript"

export function detectPageLayout(text, path) {
  if (path !== "packages/paper-crdt/src/native-layout-flow-mount.ts") return []
  const hits = []
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "flowDecorations" &&
      !node.arguments[2]
        ?.getText(source)
        .includes('!element.classList.contains("paper-rich-sheet")')
    )
      hits.push(
        "Rich Paper sheets must use measured page spacers without CSS column breaks"
      )
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
