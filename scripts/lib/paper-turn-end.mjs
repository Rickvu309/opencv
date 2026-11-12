import ts from "typescript"

const TURN = "streamPaperTurn"

function calleeName(call) {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return null
}

function discards(call) {
  let parent = call.parent
  while (
    parent &&
    (ts.isAwaitExpression(parent) || ts.isParenthesizedExpression(parent))
  )
    parent = parent.parent
  return Boolean(
    parent && (ts.isExpressionStatement(parent) || ts.isVoidExpression(parent))
  )
}

function ignoresText(handler) {
  if (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler))
    return false
  const body = handler.body
  if (ts.isBlock(body)) return body.statements.length === 0
  return ts.isIdentifier(body) && body.text === "undefined"
}

function collectsText(call) {
  const [input] = call.arguments
  if (!input || !ts.isObjectLiteralExpression(input)) return true
  const onText = input.properties.find(
    (property) => property.name && property.name.getText() === "onText"
  )
  if (!onText) return false
  if (!ts.isPropertyAssignment(onText)) return true
  return !ignoresText(onText.initializer)
}

export function detectPaperTurnEnd(text, path = "source.tsx") {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      calleeName(node) === TURN &&
      discards(node) &&
      collectsText(node)
    )
      hits.push({
        path,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        message:
          "A Paper Coach turn can end its request while the Coach is still writing; read whether it finished and follow it before saving the draft",
      })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
