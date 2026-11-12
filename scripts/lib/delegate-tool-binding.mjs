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

function reservationBefore(handler, position) {
  const reserve = statementsBefore(
    handler,
    position,
    (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      Boolean(node.initializer) &&
      ts.isAwaitExpression(node.initializer) &&
      isTransactionCall(node.initializer.expression) &&
      ["delegateCallWindow", "requireLiveDelegate", "appendDelegateCall"].every(
        (name) => node.initializer.getText().includes(`${name}(`)
      )
  )
  if (!reserve || reserve.getEnd() >= position) return null
  const name = reserve.name.text
  const denied = statementsBefore(
    handler,
    position,
    (node) =>
      ts.isIfStatement(node) &&
      node.getEnd() < position &&
      [`!${name}.allowed`, `${name}.kind === "error"`].includes(
        node.expression.getText()
      ) &&
      ts.isThrowStatement(node.thenStatement)
  )
  return denied ? reserve : null
}

export function reservedBefore(handler, position) {
  return reservationBefore(handler, position) !== null
}

function marksPreparation(reservation) {
  let found = false
  const visit = (node) => {
    if (found) return
    if (
      ts.isIfStatement(node) &&
      node.expression.getText().includes("taskNeedsPreparation(") &&
      ts.isReturnStatement(node.thenStatement) &&
      /^\{\s*prepareOutside:\s*true\s*\}$/.test(
        node.thenStatement.expression?.getText() ?? ""
      )
    )
      found = true
    ts.forEachChild(node, visit)
  }
  visit(reservation)
  return found
}

function preparedBranch(node, handler, reservation) {
  let child = node
  let current = node.parent
  while (current && current !== handler) {
    const condition = ts.isConditionalExpression(current)
      ? current.condition
      : ts.isIfStatement(current)
        ? current.expression
        : null
    if (condition && child !== condition) {
      const text = condition.getText()
      if (text.includes("taskNeedsPreparation(")) return true
      if (
        text.includes('"prepareOutside" in') &&
        reservation &&
        marksPreparation(reservation)
      )
        return true
    }
    child = current
    current = current.parent
  }
  return false
}

function namedFunctions(source) {
  const found = new Map()
  const add = (name, fn) => {
    if (!fn.body) return
    found.set(name, [...(found.get(name) ?? []), fn])
  }
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    )
      add(node.name.text, node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

export function reachableFrom(source, handler, matches) {
  const functions = namedFunctions(source)
  const found = []
  const walk = (root, sites, entered) => {
    const visit = (node) => {
      if (matches(node)) found.push({ node, sites })
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
        for (const helper of functions.get(node.expression.text) ?? [])
          if (!entered.has(helper))
            walk(helper.body, [...sites, node], new Set([...entered, helper]))
      ts.forEachChild(node, visit)
    }
    visit(root)
  }
  walk(handler, [], new Set([handler]))
  return found
}

const REGISTRY_CALLS = new Set([
  "read",
  "execute",
  "tools",
  "taskNeedsPreparation",
])

const DOOR_DATABASE = new Set(["transaction", "savepoint", "insideTransaction"])

const DOOR_IMPORTS = new Set([
  "../db/context.js",
  "../middleware.js",
  "../origin.js",
  "../registry/delegate-policy.js",
  "../registry/errors.js",
  "./agent-tool-error.js",
  "./oauth.js",
  "./call-store.js",
])

function isDeclarationName(node) {
  const parent = node.parent
  return (
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node)
  )
}

function passedAsRegistry(node, functions) {
  const call = node.parent
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression))
    return false
  const index = call.arguments.indexOf(node)
  const helpers = functions.get(call.expression.text) ?? []
  return (
    index >= 0 &&
    helpers.length > 0 &&
    helpers.every((helper) => {
      const parameter = helper.parameters[index]
      return (
        parameter &&
        ts.isIdentifier(parameter.name) &&
        parameter.name.text === "registry"
      )
    })
  )
}

function touchesRegistry(fn) {
  let found = false
  const visit = (node) => {
    if (found) return
    if (ts.isIdentifier(node) && node.text === "registry") found = true
    ts.forEachChild(node, visit)
  }
  visit(fn.body)
  return found
}

function escapes(source) {
  const functions = namedFunctions(source)
  const hits = []
  const hit = (node, rule) => hits.push({ line: lineOf(source, node), rule })
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue
    const from = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (!clause || clause.isTypeOnly) continue
    const values = [
      ...(clause.name ? [clause.name.text] : []),
      ...(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements
            .filter((element) => !element.isTypeOnly)
            .map((element) => (element.propertyName ?? element.name).text)
        : clause.namedBindings
          ? ["*"]
          : []),
    ]
    if (values.length === 0) continue
    if (/(^|\/)db\//.test(from)) {
      if (values.some((name) => !DOOR_DATABASE.has(name)))
        hit(statement, "door-database-import")
    } else if (from.startsWith(".") && !DOOR_IMPORTS.has(from))
      hit(statement, "door-import")
  }
  const visit = (node) => {
    if (ts.isIdentifier(node) && !isDeclarationName(node)) {
      const parent = node.parent
      if (node.text === "registry") {
        const used =
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === node &&
          REGISTRY_CALLS.has(parent.name.text) &&
          ts.isCallExpression(parent.parent) &&
          parent.parent.expression === parent
        if (!used && !passedAsRegistry(node, functions))
          hit(node, "registry-escape")
      }
      if (
        node.text === "db" &&
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node
      )
        hit(node, "door-database")
      const helpers = functions.get(node.text)
      if (
        helpers?.some(touchesRegistry) &&
        !(ts.isCallExpression(parent) && parent.expression === node)
      )
        hit(node, "helper-escape")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
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
  const checked = (node) => {
    const callback = transactionCallback(node)
    return Boolean(callback) && checkedBefore(callback, node.getStart(source))
  }
  const visit = (node) => {
    if (isRegisterTool(node)) {
      const handler = handlerOf(node)
      if (handler)
        for (const { node: call, sites } of reachableFrom(
          source,
          handler,
          isDataCall
        )) {
          const chain = [...sites, call]
          if (chain.some(checked)) continue
          const head = chain[0]
          const execution =
            ts.isPropertyAccessExpression(call.expression) &&
            call.expression.name.text === "execute"
          const reservation = reservationBefore(handler, head.getStart(source))
          if (
            execution &&
            reservation &&
            preparedBranch(head, handler, reservation)
          )
            continue
          hits.push({ line: lineOf(source, call) })
        }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...hits, ...escapes(source)]
}
