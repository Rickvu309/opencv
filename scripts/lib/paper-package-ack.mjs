import ts from "typescript"

const WATCHED = new Set([
  "apps/web/src/lib/paper-package-journal.ts",
  "apps/web/src/lib/paper-package-ack.ts",
  "fixture",
])

function problem(detail) {
  return { kind: "package-ack", detail }
}

function isFalse(node) {
  return node.kind === ts.SyntaxKind.FalseKeyword
}

function isSavedPassthrough(node) {
  return ts.isPropertyAccessExpression(node) && node.name.text === "saved"
}

function isTransaction(node) {
  if (ts.isIdentifier(node)) return node.text === "transaction"
  if (ts.isPropertyAccessExpression(node))
    return node.name.text === "transaction"
  if (ts.isParenthesizedExpression(node)) return isTransaction(node.expression)
  return false
}

function isCompleteString(node) {
  return ts.isStringLiteral(node) && node.text === "complete"
}

function isCompleteComparison(node) {
  if (!ts.isBinaryExpression(node)) return false
  if (node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken)
    return false
  return (
    (isTransaction(node.left) && isCompleteString(node.right)) ||
    (isTransaction(node.right) && isCompleteString(node.left))
  )
}

function returnExprs(body) {
  if (!body) return []
  if (!ts.isBlock(body)) return [body]
  const exprs = []
  const walk = (node) => {
    if (ts.isReturnStatement(node) && node.expression)
      exprs.push(node.expression)
    ts.forEachChild(node, walk)
  }
  walk(body)
  return exprs
}

function bind(scope, name, value) {
  scope.set(name, { ...value, seeing: false })
}

function collectBindings(fn, scope) {
  const body = ts.isSourceFile(fn) ? fn : fn.body
  if (!body) return
  const walk = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node !== fn) {
      bind(scope, node.name.text, { returns: returnExprs(node.body) })
      return
    }
    if (node !== body && ts.isFunctionLike(node)) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const init = node.initializer
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
        bind(scope, node.name.text, { returns: returnExprs(init.body) })
      else if (init) bind(scope, node.name.text, { expr: init })
    }
    ts.forEachChild(node, walk)
  }
  walk(body)
}

function lookup(scope, name) {
  return scope.get(name)
}

function reaches(expr, scope) {
  if (!expr) return false
  if (isCompleteComparison(expr)) return true
  if (ts.isParenthesizedExpression(expr)) return reaches(expr.expression, scope)
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  )
    return reaches(expr.left, scope) || reaches(expr.right, scope)
  if (ts.isIdentifier(expr)) {
    const bound = lookup(scope, expr.text)
    if (!bound || bound.seeing) return false
    bound.seeing = true
    const ok = bound.expr
      ? reaches(bound.expr, scope)
      : (bound.returns ?? []).some((item) => reaches(item, scope))
    bound.seeing = false
    return ok
  }
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const bound = lookup(scope, expr.expression.text)
    if (!bound || bound.seeing) return false
    bound.seeing = true
    const ok = (bound.returns ?? []).some((item) => reaches(item, scope))
    bound.seeing = false
    return ok
  }
  return false
}

function hasOr(expr, scope) {
  if (!expr) return false
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.BarBarToken
  )
    return true
  if (ts.isParenthesizedExpression(expr)) return hasOr(expr.expression, scope)
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  )
    return hasOr(expr.left, scope) || hasOr(expr.right, scope)
  if (ts.isIdentifier(expr)) {
    const bound = lookup(scope, expr.text)
    if (!bound || bound.seeing) return false
    bound.seeing = true
    const ok = bound.expr
      ? hasOr(bound.expr, scope)
      : (bound.returns ?? []).some((item) => hasOr(item, scope))
    bound.seeing = false
    return ok
  }
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const bound = lookup(scope, expr.expression.text)
    if (!bound || bound.seeing) return false
    bound.seeing = true
    const ok = (bound.returns ?? []).some((item) => hasOr(item, scope))
    bound.seeing = false
    return ok
  }
  return false
}

function savedExprs(source) {
  const scopes = new Map()
  const visitScope = (node, parent) => {
    if (!(ts.isSourceFile(node) || ts.isFunctionLike(node))) {
      ts.forEachChild(node, (child) => visitScope(child, parent))
      return
    }
    const local = new Map(parent)
    collectBindings(node, local)
    scopes.set(node, local)
    ts.forEachChild(node, (child) => visitScope(child, local))
  }
  visitScope(source, new Map())
  const found = []
  const visit = (node) => {
    let expr = null
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "saved"
    )
      expr = node.initializer
    else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "saved" &&
      node.initializer &&
      !ts.isArrowFunction(node.initializer) &&
      !ts.isFunctionExpression(node.initializer)
    )
      expr = node.initializer
    else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      node.left.text === "saved"
    )
      expr = node.right
    if (expr && !isFalse(expr) && !isSavedPassthrough(expr)) {
      let owner = node
      while (owner && !scopes.has(owner)) owner = owner.parent
      found.push({ expr, scope: owner ? scopes.get(owner) : new Map() })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function ackAlone(text) {
  const source = ts.createSourceFile(
    "paper-package-ack.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  return savedExprs(source).some(
    ({ expr, scope }) => hasOr(expr, scope) || !reaches(expr, scope)
  )
}

export function detect(text, file = "source.ts") {
  const name = String(file).replaceAll("\\", "/")
  const watched =
    WATCHED.has(name) ||
    name.endsWith("/paper-package-journal.ts") ||
    name.endsWith("/paper-package-ack.ts")
  if (!watched) return []
  if (ackAlone(text)) return [problem("ack-saved")]
  return []
}
