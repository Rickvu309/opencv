import ts from "typescript"

function sourceOf(text) {
  return ts.createSourceFile(
    "paper-page.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
}

function draftParameters(node) {
  return new Set(
    node.parameters
      .filter(
        (parameter) =>
          ts.isIdentifier(parameter.name) &&
          parameter.type?.getText() === "WritingDraft"
      )
      .map((parameter) => parameter.name.text)
  )
}

function returnedName(statement) {
  const only =
    ts.isBlock(statement) && statement.statements.length === 1
      ? statement.statements[0]
      : statement
  if (!ts.isReturnStatement(only) || !only.expression) return null
  return ts.isIdentifier(only.expression) ? only.expression.text : null
}

function isCountLimit(expression) {
  if (!ts.isBinaryExpression(expression)) return false
  const kind = expression.operatorToken.kind
  if (
    kind !== ts.SyntaxKind.GreaterThanToken &&
    kind !== ts.SyntaxKind.GreaterThanEqualsToken
  )
    return false
  return (
    ts.isNumericLiteral(expression.left) ||
    ts.isNumericLiteral(expression.right)
  )
}

export function detectDroppedInput(text) {
  let found = false
  const visit = (node, drafts) => {
    const here = ts.isFunctionLike(node)
      ? new Set([...drafts, ...draftParameters(node)])
      : drafts
    if (
      ts.isIfStatement(node) &&
      isCountLimit(node.expression) &&
      here.has(returnedName(node.thenStatement))
    )
      found = true
    ts.forEachChild(node, (child) => visit(child, here))
  }
  visit(sourceOf(text), new Set())
  return found
}

function hasSignal(options) {
  return (
    !!options &&
    ts.isObjectLiteralExpression(options) &&
    options.properties.some(
      (property) =>
        (ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property)) &&
        property.name.getText() === "signal"
    )
  )
}

export function detectAbortableWrite(text) {
  let found = false
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "runContractCommand" &&
      hasSignal(node.arguments[3])
    )
      found = true
    ts.forEachChild(node, visit)
  }
  visit(sourceOf(text))
  return found
}
