import ts from "typescript"

export function detect(text, file = "client.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  function visit(node) {
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(source)
      if (/pending\s*&&\s*!sameState/.test(condition))
        problems.push(
          "Validate merged rich updates instead of refusing concurrency"
        )
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "client"
    ) {
      const accessor = node.initializer.getText(source)
      if (/ready\s*&&\s*!conflict\s*\?\s*client/.test(accessor))
        problems.push("Keep a refused live document available for copying")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
