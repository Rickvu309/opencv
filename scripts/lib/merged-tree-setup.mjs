import ts from "typescript"

export function detect(source) {
  const ast = ts.createSourceFile(
    "merged-tree.mjs",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  function visit(node) {
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "skipped" &&
      ts.isObjectLiteralExpression(node.parent)
    )
      hits.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return hits
}
