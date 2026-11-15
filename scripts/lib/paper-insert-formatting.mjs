import ts from "typescript"

export function detectPaperInsertFormatting(text, path = "source.ts") {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = []
  function visit(node, inserting = false) {
    const inside = ts.isFunctionDeclaration(node)
      ? node.name?.text === "inserted"
      : inserting
    if (
      inside &&
      ts.isElementAccessExpression(node) &&
      ts.isNumericLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "0" &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(source) === "runsOf"
    )
      hits.push({
        path,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        message:
          "An inserted Word paragraph inherits the trailing run properties",
      })
    if (
      inside &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "at" &&
      node.arguments[0]?.getText(source) === "0" &&
      ts.isCallExpression(node.expression.expression) &&
      node.expression.expression.expression.getText(source) === "runsOf"
    )
      hits.push({
        path,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        message:
          "An inserted Word paragraph inherits the trailing run properties",
      })
    ts.forEachChild(node, (child) => visit(child, inside))
  }
  visit(source)
  return hits
}
