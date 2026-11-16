import ts from "typescript"

export function detect(text) {
  const source = ts.createSourceFile(
    "rich-text.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["replace", "replaceAll"].includes(node.expression.name.text)
    ) {
      const [pattern, replacement] = node.arguments
      if (
        pattern &&
        replacement &&
        ts.isStringLiteral(replacement) &&
        replacement.text === "" &&
        ts.isRegularExpressionLiteral(pattern) &&
        /<w:(?:u|b|i|strike)(?:\\b|[\s/>])/.test(pattern.getText(source))
      )
        hits.push(
          "Word link styling must preserve direct bold, italic, underline and strike"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
