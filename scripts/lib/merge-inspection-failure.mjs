import ts from "typescript"

const failureConditions = new Set([
  "!fetchPull(ctx,n)",
  "behind===null",
  "merged.error",
])

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
      ts.isIfStatement(node) &&
      failureConditions.has(node.expression.getText(ast).replace(/\s/g, ""))
    ) {
      const branch = node.thenStatement
      const statement = ts.isBlock(branch) ? branch.statements[0] : branch
      const result = ts.isReturnStatement(statement) && statement.expression
      const failed =
        result &&
        ts.isObjectLiteralExpression(result) &&
        result.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(ast) === "failed"
        )
      if (
        !failed ||
        !ts.isArrayLiteralExpression(failed.initializer) ||
        failed.initializer.elements.length === 0
      )
        hits.push(
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
        )
    }
    ts.forEachChild(node, visit)
  }
  for (const node of ast.statements) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "mergeResultFacts"
    )
      visit(node)
  }
  return hits
}
