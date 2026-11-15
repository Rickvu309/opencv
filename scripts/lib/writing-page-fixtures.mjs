import ts from "typescript"

export function detectUnownedPageRequest(text) {
  const source = ts.createSourceFile(
    "writing-page.test.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Promise"
    ) {
      const executor = node.arguments?.[0]
      if (
        executor &&
        (ts.isArrowFunction(executor) || ts.isFunctionExpression(executor)) &&
        executor.parameters.length === 0 &&
        ((ts.isIdentifier(executor.body) &&
          executor.body.text === "undefined") ||
          (ts.isBlock(executor.body) && executor.body.statements.length === 0))
      )
        hits.push(
          "page request fixtures must own a response that teardown can settle"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
