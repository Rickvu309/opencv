import ts from "typescript"

export const UNKNOWN = { kind: "unknown" }

export const SEARCH = new Set(["indexOf", "includes", "toContain", "search"])

export const KEEPS_TEXT = new Set([
  "slice",
  "substring",
  "substr",
  "trim",
  "trimStart",
  "trimEnd",
  "toString",
])

export const PATH_OPS = new Set(["join", "resolve", "dirname", "normalize"])

const FALSE_COMPARE = new Set([
  "toBe",
  "toEqual",
  "toStrictEqual",
  "equal",
  "strictEqual",
])

export function mergeText(values) {
  const files = []
  for (const value of values) {
    if (value.kind !== "text") return UNKNOWN
    files.push(...value.files)
  }
  return { kind: "text", files: [...new Set(files)].sort() }
}

export function paramNames(node) {
  const names = []
  for (const param of node.parameters ?? []) {
    if (ts.isIdentifier(param.name)) names.push(param.name.text)
  }
  return names
}

function calleeName(node) {
  const expr = node.expression
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) || ts.isPropertyAccessChain(expr))
    return expr.name.text
  return ""
}

function unwrap(node) {
  let current = node
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isTypeAssertionExpression(current))
  )
    current = current.expression
  return current
}

export function literalNode(node) {
  const inner = unwrap(node)
  if (
    inner &&
    (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner))
  )
    return inner
  return null
}

function isFalseOrMinusOne(node) {
  const inner = unwrap(node)
  if (!inner) return false
  if (inner.kind === ts.SyntaxKind.FalseKeyword) return true
  if (
    ts.isPrefixUnaryExpression(inner) &&
    inner.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(inner.operand) &&
    inner.operand.text === "1"
  )
    return true
  return false
}

export function isNegated(node) {
  let current = node
  for (let depth = 0; depth < 8; depth++) {
    const parent = current.parent
    if (!parent) return false
    if (
      ts.isPrefixUnaryExpression(parent) &&
      parent.operator === ts.SyntaxKind.ExclamationToken &&
      parent.operand === current
    )
      return true
    if (
      ts.isBinaryExpression(parent) &&
      (parent.left === current || parent.right === current)
    ) {
      const other = parent.left === current ? parent.right : parent.left
      const op = parent.operatorToken.kind
      const equal =
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.EqualsEqualsToken
      const notEqual =
        op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsToken
      const less =
        op === ts.SyntaxKind.LessThanToken ||
        op === ts.SyntaxKind.LessThanEqualsToken
      if ((equal || less) && isFalseOrMinusOne(other)) return true
      if (
        less &&
        parent.left === current &&
        ts.isNumericLiteral(unwrap(other)) &&
        Number(unwrap(other).text) <= 0
      )
        return true
      if (notEqual && unwrap(other)?.kind === ts.SyntaxKind.TrueKeyword)
        return true
    }
    if (ts.isCallExpression(parent)) {
      const name = calleeName(parent)
      if (name === "toBeFalsy") return true
      if (
        FALSE_COMPARE.has(name) &&
        parent.arguments.some((arg) => isFalseOrMinusOne(arg))
      )
        return true
    }
    if (
      ts.isExpressionStatement(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isReturnStatement(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isBlock(parent) ||
      ts.isSourceFile(parent)
    )
      return false
    current = parent
  }
  return false
}

export function importTables(sourceFile) {
  const pathNs = new Set()
  const pathFns = new Map()
  const urlFns = new Map()
  for (const stmt of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(stmt) ||
      !ts.isStringLiteral(stmt.moduleSpecifier)
    )
      continue
    const mod = stmt.moduleSpecifier.text
    const clause = stmt.importClause
    if (!clause || clause.isTypeOnly) continue
    const named = clause.namedBindings
    if (mod === "node:path" || mod === "path") {
      if (clause.name) pathNs.add(clause.name.text)
      if (named && ts.isNamespaceImport(named)) pathNs.add(named.name.text)
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          if (el.isTypeOnly) continue
          const imported = (el.propertyName ?? el.name).text
          if (PATH_OPS.has(imported)) pathFns.set(el.name.text, imported)
        }
      }
    }
    if (
      (mod === "node:url" || mod === "url") &&
      named &&
      ts.isNamedImports(named)
    ) {
      for (const el of named.elements) {
        if (el.isTypeOnly) continue
        const imported = (el.propertyName ?? el.name).text
        if (imported === "fileURLToPath" || imported === "pathToFileURL")
          urlFns.set(el.name.text, imported)
      }
    }
  }
  return { pathNs, pathFns, urlFns }
}
