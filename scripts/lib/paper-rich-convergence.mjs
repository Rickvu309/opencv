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
    if (
      ts.isIfStatement(node) &&
      /!this\.adapter\.read\(merged\)/.test(node.expression.getText(source))
    ) {
      const gate = node.parent
        .getText(source)
        .slice(0, node.pos - node.parent.pos)
        .replace(/\s/g, "")
      if (
        !/preservePendingContent\(this\.ydoc,this\.server,merged\)/.test(
          gate
        ) ||
        !/restorePendingContent\(merged,restorations\)/.test(gate)
      )
        problems.push(
          "Check pending content survival before accepting a rich merge"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
