import ts from "typescript"

const parse = (source) =>
  ts.createSourceFile("paper-save.ts", source, ts.ScriptTarget.Latest, true)

const expiry = (node, file) =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind === ts.SyntaxKind.GreaterThanEqualsToken &&
  node.left.getText(file) === "request.now" &&
  node.right.getText(file) === "lease.until"

export function detect(source) {
  const file = parse(source)
  const issues = []
  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue
    let expires = false
    const visit = (node) => {
      if (expiry(node, file)) expires = true
      if (
        statement.name?.text === "canShowSaved" &&
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        [node.left, node.right].some(
          (side) => ts.isIdentifier(side) && side.text === "receipt"
        ) &&
        [node.left, node.right].some(
          (side) =>
            ts.isCallExpression(side) &&
            side.expression.getText(file) === "state.receipts.get"
        )
      )
        issues.push("Compare the stored receipt by id and hash")
      if (
        statement.name?.text === "canShowSaved" &&
        ts.isReturnStatement(node) &&
        node.expression?.kind === ts.SyntaxKind.TrueKeyword
      )
        issues.push("Saved needs a stored receipt")
      ts.forEachChild(node, visit)
    }
    visit(statement)
    if (statement.name?.text === "save" && !expires)
      issues.push("Refuse an expired lease before takeover")
  }
  return issues
}

export function mutate(source, fault) {
  const file = parse(source)
  let changed = 0
  const transformed = ts.transform(file, [
    (context) => {
      const visit = (node) => {
        if (
          fault === "saved" &&
          ts.isFunctionDeclaration(node) &&
          node.name?.text === "canShowSaved"
        ) {
          changed += 1
          return context.factory.updateFunctionDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            node.type,
            context.factory.createBlock([
              context.factory.createReturnStatement(
                context.factory.createTrue()
              ),
            ])
          )
        }
        if (fault === "expiry" && expiry(node, file)) {
          changed += 1
          return context.factory.createFalse()
        }
        return ts.visitEachChild(node, visit, context)
      }
      return (root) => ts.visitNode(root, visit)
    },
  ])
  try {
    if (changed !== 1)
      throw new Error(`${fault}: expected one mutation, got ${changed}`)
    return ts.createPrinter().printFile(transformed.transformed[0])
  } finally {
    transformed.dispose()
  }
}
