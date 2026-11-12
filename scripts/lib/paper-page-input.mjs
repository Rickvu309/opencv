import ts from "typescript"

function sourceOf(text, file) {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function isBeforeInputListener(node) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  const [kind] = node.arguments
  return (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === "addEventListener" &&
    kind !== undefined &&
    ts.isStringLiteralLike(kind) &&
    kind.text === "beforeinput"
  )
}

function functionNamed(source, name) {
  let found = null
  const visit = (node) => {
    if (found) return
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    )
      found = node.initializer
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body)
      found = node
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function handlersOf(source) {
  const handlers = []
  const visit = (node) => {
    if (isBeforeInputListener(node)) {
      const handler = node.arguments[1]
      if (handler && ts.isIdentifier(handler))
        handlers.push(functionNamed(source, handler.text) ?? handler)
      else if (handler) handlers.push(handler)
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "onBeforeInput" &&
      node.initializer
    )
      handlers.push(node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return handlers
}

function callsInputRule(handler) {
  let calls = false
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "inputRule"
    )
      calls = true
    ts.forEachChild(node, visit)
  }
  visit(handler)
  return calls
}

function handPicks(handler) {
  const picks = []
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind)
    ) {
      const sides = [node.left, node.right]
      const readsType = sides.some(
        (side) =>
          ts.isPropertyAccessExpression(side) && side.name.text === "inputType"
      )
      const literal = sides.some((side) => ts.isStringLiteralLike(side))
      if (readsType && literal) picks.push(node)
    }
    if (
      ts.isCaseClause(node) &&
      ts.isStringLiteralLike(node.expression) &&
      ts.isSwitchStatement(node.parent.parent) &&
      ts.isPropertyAccessExpression(node.parent.parent.expression) &&
      node.parent.parent.expression.name.text === "inputType"
    )
      picks.push(node)
    ts.forEachChild(node, visit)
  }
  visit(handler)
  return picks
}

export function detectOpenInput(text, file = "page.tsx") {
  const source = sourceOf(text, file)
  const problems = []
  for (const handler of handlersOf(source)) {
    if (!callsInputRule(handler))
      problems.push({
        kind: "beforeinput-without-input-rule",
        file,
        line: lineOf(source, handler),
      })
    for (const pick of handPicks(handler))
      problems.push({
        kind: "input-type-picked-by-hand",
        file,
        line: lineOf(source, pick),
      })
  }
  return problems
}
