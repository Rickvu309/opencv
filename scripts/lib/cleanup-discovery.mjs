import ts from "typescript"

export function detect(source) {
  const ast = ts.createSourceFile(
    "work.mjs",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "startsWith" &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === "path"
    )
      hits.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return hits
}
