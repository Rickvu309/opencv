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

function unwrap(node) {
  let current = node
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current))
  )
    current = current.expression
  return current
}

function isSavedPassthrough(node) {
  const value = unwrap(node)
  return (
    ts.isPropertyAccessExpression(value) &&
    value.name.text === "saved" &&
    unwrap(value.expression)?.kind === ts.SyntaxKind.Identifier &&
    unwrap(value.expression).text === "draft"
  )
}

function isTransaction(node) {
  const value = unwrap(node)
  if (!value) return false
  if (ts.isIdentifier(value)) return value.text === "transaction"
  if (
    !ts.isPropertyAccessExpression(value) ||
    value.name.text !== "transaction"
  )
    return false
  const object = unwrap(value.expression)
  return ts.isIdentifier(object) && object.text === "local"
}

function isCompleteString(node) {
  const value = unwrap(node)
  return ts.isStringLiteral(value) && value.text === "complete"
}

function isCompleteComparison(node) {
  const value = unwrap(node)
  if (!value || !ts.isBinaryExpression(value)) return false
  if (value.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken)
    return false
  return (
    (isTransaction(value.left) && isCompleteString(value.right)) ||
    (isTransaction(value.right) && isCompleteString(value.left))
  )
}

function returnExprs(body) {
  if (!body) return []
  if (!ts.isBlock(body)) return [body]
  const exprs = []
  const walk = (node) => {
    if (ts.isFunctionLike(node)) return
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

function bindName(scope, name) {
  if (ts.isIdentifier(name)) bind(scope, name.text, { blocked: true })
}

function collectBindings(fn, scope) {
  if (ts.isFunctionLike(fn)) {
    for (const param of fn.parameters) bindName(scope, param.name)
  }
  const body = ts.isSourceFile(fn) ? fn : fn.body
  if (!body) return
  const walk = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node !== fn) {
      const inner = new Map(scope)
      collectBindings(node, inner)
      bind(scope, node.name.text, {
        returns: returnExprs(node.body),
        scope: inner,
      })
      return
    }
    if (node !== body && ts.isFunctionLike(node)) return
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        const init = node.initializer
        if (
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          const inner = new Map(scope)
          collectBindings(init, inner)
          bind(scope, node.name.text, {
            returns: returnExprs(init.body),
            scope: inner,
          })
        } else if (init) bind(scope, node.name.text, { expr: init })
      } else if (ts.isObjectBindingPattern(node.name)) {
        for (const el of node.name.elements) {
          if (ts.isBindingElement(el)) bindName(scope, el.name)
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(body)
}

function lookup(scope, name) {
  return scope.get(name)
}

function reaches(expr, scope) {
  const value = unwrap(expr)
  if (!value) return false
  if (isFalse(value) || isCompleteComparison(value)) return true
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  )
    return reaches(value.left, scope) || reaches(value.right, scope)
  if (ts.isIdentifier(value)) {
    const bound = lookup(scope, value.text)
    if (!bound || bound.seeing || bound.blocked || !bound.expr) return false
    bound.seeing = true
    const ok = reaches(bound.expr, scope)
    bound.seeing = false
    return ok
  }
  if (ts.isCallExpression(value) && ts.isIdentifier(value.expression)) {
    const bound = lookup(scope, value.expression.text)
    if (!bound || bound.seeing || bound.blocked) return false
    const items = bound.returns ?? []
    if (items.length === 0) return false
    bound.seeing = true
    const inner = bound.scope ?? scope
    const ok = items.every((item) => reaches(item, inner))
    bound.seeing = false
    return ok
  }
  return false
}

function hasOr(expr, scope) {
  const value = unwrap(expr)
  if (!value) return false
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.BarBarToken
  )
    return true
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  )
    return hasOr(value.left, scope) || hasOr(value.right, scope)
  if (ts.isIdentifier(value)) {
    const bound = lookup(scope, value.text)
    if (!bound || bound.seeing || bound.blocked || !bound.expr) return false
    bound.seeing = true
    const ok = hasOr(bound.expr, scope)
    bound.seeing = false
    return ok
  }
  if (ts.isCallExpression(value) && ts.isIdentifier(value.expression)) {
    const bound = lookup(scope, value.expression.text)
    if (!bound || bound.seeing || bound.blocked) return false
    const items = bound.returns ?? []
    bound.seeing = true
    const inner = bound.scope ?? scope
    const ok = items.some((item) => hasOr(item, inner))
    bound.seeing = false
    return ok
  }
  return false
}

function savedName(node) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isStringLiteral(node)) return node.text
  return null
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
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node)) &&
      savedName(node.name) === "saved"
    )
      expr = ts.isShorthandPropertyAssignment(node)
        ? node.name
        : node.initializer
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
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      if (ts.isIdentifier(node.left) && node.left.text === "saved")
        expr = node.right
      else if (
        ts.isPropertyAccessExpression(node.left) &&
        node.left.name.text === "saved"
      )
        expr = node.right
    }
    if (expr && !isFalse(unwrap(expr)) && !isSavedPassthrough(expr)) {
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
