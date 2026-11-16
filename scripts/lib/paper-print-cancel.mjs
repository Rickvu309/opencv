import ts from "typescript"

export function detect(text) {
  const tree = ts.createSourceFile(
    "paper-print.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const owner = tree.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "printPaper"
  )
  if (!owner?.body) return []
  const bindings = new Map()
  const visit = (node, predicate) =>
    predicate(node) ||
    ts.forEachChild(node, (child) => visit(child, predicate)) === true
  visit(owner.body, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      bindings.set(node.name.text, node.initializer)
    return false
  })
  const completes = (node, seen = new Set()) => {
    if (
      ts.isIdentifier(node) &&
      bindings.has(node.text) &&
      !seen.has(node.text)
    )
      return completes(bindings.get(node.text), new Set(seen).add(node.text))
    return visit(node, (child) => {
      if (!ts.isCallExpression(child) || !ts.isIdentifier(child.expression))
        return false
      if (child.expression.text === "onDone") return true
      if (
        bindings.has(child.expression.text) &&
        !seen.has(child.expression.text)
      )
        return completes(
          bindings.get(child.expression.text),
          new Set(seen).add(child.expression.text)
        )
      return false
    })
  }
  return owner.body.statements.some(
    (node) =>
      ts.isReturnStatement(node) &&
      node.expression &&
      completes(node.expression)
  )
    ? ["Print cleanup completes the caller"]
    : []
}
