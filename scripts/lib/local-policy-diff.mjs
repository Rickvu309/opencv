import ts from "typescript"

export function detect(source) {
  const ast = ts.createSourceFile(
    "pull-facts.mjs",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["gh", "json"].includes(node.expression.text)
    ) {
      const words = node.arguments
        .filter(ts.isStringLiteralLike)
        .map((arg) => arg.text)
      if (words[0] === "pr" && words[1] === "diff")
        hits.push(
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return hits
}
