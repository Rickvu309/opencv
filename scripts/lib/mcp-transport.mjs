import ts from "typescript"

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function calleeName(node) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return null
}

function isTransactionCall(node) {
  if (!node || !ts.isCallExpression(node) || !node.expression) return false
  return calleeName(node.expression) === "transaction"
}

function unwrapTransaction(node) {
  if (!node) return null
  let current = node
  const seen = new Set()
  while (current && !seen.has(current)) {
    seen.add(current)
    if (
      ts.isAwaitExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isReturnStatement(current) ||
      ts.isExpressionStatement(current)
    ) {
      current = current.expression ?? null
      continue
    }
    if (ts.isVariableStatement(current)) {
      for (const decl of current.declarationList?.declarations ?? []) {
        const call = unwrapTransaction(decl?.initializer)
        if (call) return call
      }
      return null
    }
    if (ts.isVariableDeclaration(current)) {
      current = current.initializer ?? null
      continue
    }
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      current = current.right ?? null
      continue
    }
    break
  }
  return isTransactionCall(current) ? current : null
}

function enclosesTransport(node) {
  if (!node) return false
  let found = false
  const visit = (current) => {
    if (found || !current) return
    if (
      ts.isCallExpression(current) &&
      current.expression &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name?.text === "fetch"
    ) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

const CHAIN_MESSAGE = "MCP route handlers use await, not promise chains"

function promiseChains(root) {
  const found = []
  const visit = (node) => {
    if (!node) return
    if (
      ts.isCallExpression(node) &&
      node.expression &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === "then" ||
        node.expression.name.text === "catch")
    )
      found.push(node)
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

function routeWrappedInTransaction(callback) {
  const body = callback?.body
  if (!body) return false
  if (!ts.isBlock(body)) return Boolean(unwrapTransaction(body))
  return body.statements.some((statement) => {
    const call = unwrapTransaction(statement)
    return Boolean(call && enclosesTransport(call))
  })
}

function isMcpRoute(node, source) {
  if (!ts.isCallExpression(node) || !node.expression) return false
  const name = calleeName(node.expression)
  if (name !== "all" && name !== "use" && name !== "post") return false
  const path = node.arguments?.[0]
  if (!path || !ts.isStringLiteralLike(path) || !path.text.includes("/mcp"))
    return false
  return !node.getText(source).includes("well-known")
}

function namedFunction(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer))
  )
    return node.name.text
  return null
}

function collectBindings(source) {
  const functions = new Map()
  const values = new Map()
  const visit = (node) => {
    const name = namedFunction(node)
    if (name) functions.set(name, node)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !name
    )
      values.set(node.name.text, node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { functions, values }
}

function callbackOf(call) {
  const args = call?.arguments
  if (!args) return null
  return (
    args.find(
      (arg) => arg && (ts.isFunctionExpression(arg) || ts.isArrowFunction(arg))
    ) ?? null
  )
}

function callsNamed(root, names) {
  const found = new Set()
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression &&
      ts.isIdentifier(node.expression) &&
      names.has(node.expression.text)
    )
      found.add(node.expression.text)
    if (ts.isFunctionLike(node) && node !== root) return
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

function hasCallee(root, name) {
  let found = false
  const visit = (node) => {
    if (found) return
    if (ts.isCallExpression(node) && node.expression) {
      const callee = node.expression
      const called = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : null
      if (called === name) found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

function webOriginsIncludes(root) {
  let found = false
  const visit = (node) => {
    if (found) return
    if (
      ts.isCallExpression(node) &&
      node.expression &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "includes" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "webOrigins"
    )
      found = true
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

export function detect(text, file = "http.ts") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const { functions, values } = collectBindings(source)
  const routes = []
  const visit = (node) => {
    if (isMcpRoute(node, source)) {
      const callback = callbackOf(node)
      if (callback) routes.push(callback)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (routes.length === 0) return []
  const hits = []
  for (const route of routes) {
    if (routeWrappedInTransaction(route))
      hits.push({ kind: "transaction", line: lineOf(source, route) })
    for (const call of promiseChains(route))
      hits.push({
        kind: "chain",
        line: lineOf(source, call),
        message: CHAIN_MESSAGE,
      })
  }
  const reachable = new Set(routes)
  const queue = [...routes]
  const names = new Set([...functions.keys(), ...values.keys()])
  while (queue.length) {
    const fn = queue.pop()
    for (const name of callsNamed(fn, names)) {
      const decl = functions.get(name) ?? values.get(name)
      if (!decl || reachable.has(decl)) continue
      reachable.add(decl)
      queue.push(decl)
    }
  }
  const nodes = [...reachable]
  const broader = nodes.some(
    (node) =>
      hasCallee(node, "localhostAllowedOrigins") ||
      hasCallee(node, "validateOriginHeader") ||
      hasCallee(node, "originValidation")
  )
  const allowlist = nodes.some(
    (node) =>
      webOriginsIncludes(node) ||
      (hasCallee(node, "isAllowedOrigin") && !broader)
  )
  if (allowlist) {
    const node = nodes.find(
      (item) => webOriginsIncludes(item) || hasCallee(item, "isAllowedOrigin")
    )
    hits.push({ kind: "allowlist", line: lineOf(source, node) })
  }
  return hits
}
