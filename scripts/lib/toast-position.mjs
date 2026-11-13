import ts from "typescript"

const TOAST_CALLEE = /^toast(?:\.\w+)?$/

export function detect(source, fileName = "file.tsx") {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const found = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      TOAST_CALLEE.test(node.expression.getText(file))
    ) {
      for (const argument of node.arguments) {
        if (!ts.isObjectLiteralExpression(argument)) continue
        const position = argument.properties.find(
          (property) =>
            property.name &&
            ts.isIdentifier(property.name) &&
            property.name.text === "position"
        )
        if (position)
          found.push({
            line:
              file.getLineAndCharacterOfPosition(position.getStart(file)).line +
              1,
            why: `${node.expression.getText(file)}() picks its own position, so it skips the placement that keeps toasts off the Menu button, the Coach dock and page headers`,
          })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
