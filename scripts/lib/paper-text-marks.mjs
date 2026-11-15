import ts from "typescript"

export function detectMixedTextUnits(text) {
  const source = ts.createSourceFile(
    "text.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Array" &&
      node.expression.name.text === "from"
    ) {
      const [input, callback] = node.arguments
      const index =
        callback && ts.isFunctionLike(callback)
          ? callback.parameters[1]?.name
          : undefined
      if (input && ts.isIdentifier(input) && index && ts.isIdentifier(index)) {
        const find = (child) => {
          if (
            ts.isElementAccessExpression(child) &&
            ts.isIdentifier(child.expression) &&
            child.expression.text === input.text &&
            child.argumentExpression &&
            ts.isIdentifier(child.argumentExpression) &&
            child.argumentExpression.text === index.text
          )
            hits.push(
              "text iteration cannot use a code point index as a UTF-16 index"
            )
          ts.forEachChild(child, find)
        }
        find(callback)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
