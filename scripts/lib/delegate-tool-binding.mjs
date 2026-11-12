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

function statementsBefore(handler, position, matches) {
  let found = null
  const visit = (node) => {
    if (found || !node || node.getStart() >= position) return
    if (matches(node)) {
      found = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(handler.body)
  return found
}

export function reservedBefore(handler, position) {
  const reserve = statementsBefore(
    handler,
    position,
    (node) =>
      ts.isVariableDeclaration(node) &&
      node.name.getText() === "reservation" &&
      Boolean(node.initializer) &&
      ts.isAwaitExpression(node.initializer) &&
      isTransactionCall(node.initializer.expression)
  )
  if (!reserve || reserve.getEnd() >= position) return false
  const denied = statementsBefore(
    handler,
    position,
    (node) =>
      ts.isIfStatement(node) &&
      node.getEnd() < position &&
      node.expression.getText() === "!reservation.allowed" &&
      ts.isThrowStatement(node.thenStatement)
  )
  const text = reserve.getText()
  return (
    Boolean(denied) &&
    ["delegateCallWindow", "requireLiveDelegate", "appendDelegateCall"].every(
      (name) => text.includes(`${name}(`)
    )
  )
}

function preparedBranch(node, handler) {
  let child = node
  let current = node.parent
  while (current && current !== handler) {
    const condition = ts.isConditionalExpression(current)
      ? current.condition
      : ts.isIfStatement(current)
        ? current.expression
        : null
    if (
      condition &&
      child !== condition &&
      condition.getText().includes("taskNeedsPreparation(")
    )
      return true
    child = current
    current = current.parent
  }
  return false
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
            const safe = callback
              ? checkedBefore(callback, current.getStart(source))
              : execution &&
                reservedBefore(handler, current.getStart(source)) &&
                preparedBranch(current, handler)
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
