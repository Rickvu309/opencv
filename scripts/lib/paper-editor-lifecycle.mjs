import ts from "typescript"

export function detect(text, file = "rich-page.tsx") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const calls = []
  const throws = []
  const lifetime = new Set()
  function visit(node) {
    if (ts.isCallExpression(node)) calls.push(node)
    if (ts.isThrowStatement(node)) throws.push(node)
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      node.right.kind === ts.SyntaxKind.FalseKeyword
    )
      lifetime.add(node.left.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  const hasCall = (name) =>
    calls.some((node) => node.expression.getText(source).endsWith(name))
  const problems = []
  if (file.endsWith("rich-page.tsx") && !hasCall("mountRichEditorLifecycle"))
    problems.push("Paper must mount through the document lifecycle")
  if (file.endsWith("rich-editor-lifecycle.ts")) {
    for (const name of [".subscribe", ".restoreSelection", ".released"])
      if (!hasCall(name)) problems.push(`Missing lifecycle operation ${name}`)
    const resetMount = calls.some(
      (node) =>
        node.expression.getText(source).endsWith(".subscribe") &&
        node.arguments.some(
          (argument) =>
            argument.getText(source).includes('change === "reset"') &&
            argument.getText(source).includes("mount()")
        )
    )
    if (!resetMount) problems.push("Canonical document resets must remount")
  }
  function closedTest(node) {
    if (ts.isParenthesizedExpression(node)) return closedTest(node.expression)
    if (ts.isPrefixUnaryExpression(node)) {
      const value = node.operand
      return (
        node.operator === ts.SyntaxKind.ExclamationToken &&
        ((ts.isIdentifier(value) &&
          (lifetime.has(value.text) || value.text === "editor")) ||
          (ts.isPropertyAccessExpression(value) &&
            ["editor", "isEditable"].includes(value.name.text)))
      )
    }
    if (ts.isPropertyAccessExpression(node))
      return node.name.text === "isDestroyed"
    if (ts.isBinaryExpression(node)) {
      if (
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      )
        return closedTest(node.left) || closedTest(node.right)
      if (
        node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        node.right.kind === ts.SyntaxKind.FalseKeyword
      )
        return ts.isIdentifier(node.left) && lifetime.has(node.left.text)
    }
    return false
  }
  function exposed(node) {
    for (let at = node.parent; at; at = at.parent) {
      if (ts.isObjectLiteralExpression(at) && ts.isReturnStatement(at.parent))
        return file.endsWith("editor.ts")
      if (ts.isJsxAttribute(at) && /^on[A-Z]/.test(at.name.getText(source)))
        return file.endsWith("rich-page.tsx")
    }
    return false
  }
  for (const thrown of throws) {
    if (!exposed(thrown)) continue
    for (let at = thrown.parent; at; at = at.parent) {
      if (
        ts.isIfStatement(at) &&
        closedTest(at.expression) &&
        thrown.getStart(source) >= at.thenStatement.getStart(source) &&
        thrown.getEnd() <= at.thenStatement.getEnd()
      ) {
        problems.push("Released editor handlers must be harmless")
        break
      }
    }
  }
  if (file.endsWith("editor.ts")) {
    const capture = calls.find(
      (node) =>
        ts.isIdentifier(node.expression) &&
        node.expression.text === "captureEditorSelection"
    )
    let destroy = capture?.parent
    while (destroy && !ts.isBlock(destroy)) destroy = destroy.parent
    if (!destroy || !ts.isBlock(destroy))
      problems.push("Editor release must capture selection before unmount")
    else {
      const release = calls.find(
        (node) =>
          node.getStart(source) > destroy.getStart(source) &&
          node.getEnd() < destroy.getEnd() &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "onRelease"
      )
      const unmount = calls.find(
        (node) =>
          node.getStart(source) > destroy.getStart(source) &&
          node.getEnd() < destroy.getEnd() &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "unmount"
      )
      if (
        !release ||
        !unmount ||
        capture.getStart(source) > release.getStart(source) ||
        release.getStart(source) > unmount.getStart(source)
      )
        problems.push("Editor release must capture selection before unmount")
    }
  }
  return problems
}
