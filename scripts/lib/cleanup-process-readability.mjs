import ts from "typescript"

export function detect(source) {
  const ast = ts.createSourceFile(
    "activity.mjs",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  function has(node, predicate) {
    if (predicate(node)) return true
    return Boolean(
      ts.forEachChild(node, (child) => has(child, predicate) || undefined)
    )
  }
  function visit(node) {
    if (
      ts.isTryStatement(node) &&
      node.catchClause &&
      has(node.tryBlock, ts.isForOfStatement) &&
      has(
        node.catchClause,
        (child) =>
          ts.isPropertyAssignment(child) &&
          child.name.getText(ast) === "safe" &&
          child.initializer.kind === ts.SyntaxKind.FalseKeyword
      )
    )
      hits.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return hits
}
