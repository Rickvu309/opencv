import ts from "typescript"

export function detect(text, file = "http.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = []
  let pending = 0
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = node.properties.filter(ts.isPropertyAssignment)
      const status = properties.find(
        (item) => item.name.getText(source) === "status"
      )
      if (
        status &&
        ts.isStringLiteral(status.initializer) &&
        status.initializer.text === "pending approval"
      ) {
        pending += 1
        const id = properties.find(
          (item) => item.name.getText(source) === "proposalId"
        )
        if (
          !id ||
          !ts.isPropertyAccessExpression(id.initializer) ||
          id.initializer.expression.getText(source) !== "value" ||
          id.initializer.name.text !== "pendingActionId"
        ) {
          hits.push({
            line:
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1,
            kind: "missing-literal-proposal-id",
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!pending)
    hits.push({ line: 1, kind: "missing-pending-approval-response" })
  return hits
}
