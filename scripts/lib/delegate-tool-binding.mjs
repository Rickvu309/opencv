import ts from "typescript"

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function calleeName(node) {
  if (!node) return null
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return null
}

function isTransactionCall(node) {
  return (
    ts.isCallExpression(node) && calleeName(node.expression) === "transaction"
  )
}

function isRegisterTool(node) {
  return (
    ts.isCallExpression(node) && calleeName(node.expression) === "registerTool"
  )
}

function isDataCall(node) {
  if (!ts.isCallExpression(node) || !node.expression) return false
  const expr = node.expression
  if (ts.isPropertyAccessExpression(expr))
    return expr.name.text === "read" || expr.name.text === "execute"
  return ts.isIdentifier(expr) && expr.text === "createProposal"
}

function handlerOf(call) {
  for (let index = call.arguments.length - 1; index >= 0; index -= 1) {
    const argument = call.arguments[index]
    if (
      argument &&
      (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
    )
      return argument
  }
  return null
}

function transactionCallback(node) {
  let current = node.parent
  while (current) {
    if (isTransactionCall(current)) {
      const callback = current.arguments[0]
      if (
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        callback.body &&
        node.getStart() >= callback.body.getStart() &&
        node.getEnd() <= callback.body.getEnd()
      )
        return callback
    }
    current = current.parent
  }
  return null
}

function checkedBefore(callback, position) {
  let found = false
  const visit = (node) => {
    if (found || !node || node.getStart() >= position) return
    if (
      ts.isCallExpression(node) &&
      calleeName(node.expression) === "requireLiveDelegate"
    )
      found = true
    ts.forEachChild(node, visit)
  }
  visit(callback)
  return found
}

export function reservedBefore(handler, position) {
  const statements = handler.body.statements ?? []
  const reserve = statements.find(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          declaration.name.getText() === "reservation" &&
          declaration.initializer &&
          ts.isAwaitExpression(declaration.initializer) &&
          isTransactionCall(declaration.initializer.expression)
      )
  )
  if (!reserve || reserve.getEnd() >= position) return false
  const text = reserve.getText()
  const denied = statements.some(
    (statement) =>
      ts.isIfStatement(statement) &&
      statement.getEnd() < position &&
      statement.expression.getText() === "!reservation.allowed" &&
      ts.isThrowStatement(statement.thenStatement)
  )
  return (
    denied &&
    ["delegateCallWindow", "requireLiveDelegate", "appendDelegateCall"].every(
      (name) => text.includes(`${name}(`)
    )
  )
}

export function detect(text) {
  const source = ts.createSourceFile(
    "binding.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const hits = []
  const visit = (node) => {
    if (isRegisterTool(node)) {
      const handler = handlerOf(node)
      if (handler) {
        const scan = (current) => {
          if (!current || current === handler) {
            ts.forEachChild(current ?? handler, scan)
            return
          }
          if (isDataCall(current)) {
            const callback = transactionCallback(current)
            const execution =
              ts.isPropertyAccessExpression(current.expression) &&
              current.expression.name.text === "execute"
            const safe = execution
              ? !callback && reservedBefore(handler, current.getStart(source))
              : callback && checkedBefore(callback, current.getStart(source))
            if (!safe) hits.push({ line: lineOf(source, current) })
          }
          ts.forEachChild(current, scan)
        }
        scan(handler)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
