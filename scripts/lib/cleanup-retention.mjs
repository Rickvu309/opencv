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
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text
      if (
        (method === "deleteRemoteBranch" && node.arguments.length < 3) ||
        (method === "includes" &&
          node.expression.expression.getText(ast) === "excluded")
      )
        hits.push(
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
        )
    }
    if (
      ts.isConditionalExpression(node) &&
      node.condition.getText(ast) === "issueNo" &&
      node.whenTrue.getText(ast).includes("issueLabels")
    )
      hits.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return hits
}
