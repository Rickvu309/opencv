import { createRequire } from "node:module"

const ts = createRequire(import.meta.url)("typescript")

const CASE_APIS = new Set([
  "it",
  "test",
  "describe",
  "suite",
  "bench",
  "context",
  "specify",
])
const GROUP_NAMES = new Set(["describe", "suite", "context"])
const NOT_A_CASE = new Set([
  "beforeEach",
  "afterEach",
  "beforeAll",
  "afterAll",
  "before",
  "after",
  "use",
  "extend",
  "setTimeout",
  "configure",
  "info",
  "fixme",
  "slow",
  "mock",
])
export const MARKS = Object.freeze({
  skip: "skip",
  todo: "todo",
  fails: "fails",
  failing: "fails",
  only: "only",
  skipIf: "skip",
  runIf: "skip",
  fixme: "skip",
})
const OPTION_MARKS = new Set(["skip", "todo", "only"])
const ASSERT_MODULE = /^(?:node:)?assert(?:\/strict)?$/
const EXPECT_MODULES = new Set([
  "vitest",
  "@playwright/test",
  "@jest/globals",
  "bun:test",
  "expect",
  "chai",
])
const ALWAYS_ASSERTING = new Set([
  "expect",
  "assert",
  "expectTypeOf",
  "assertType",
])
const BOUND_UP = /(?:CEILING|MAX|LIMIT|BUDGET|CAP|TOLERANCE|THRESHOLD)/
const BOUND_DOWN = /(?:FLOOR|MIN)(?:_|$)/

export const normalise = (text) =>
  String(text)
    .replace(/\s+/g, " ")
    .replace(/([([{]) /g, "$1")
    .replace(/ ([)\]}])/g, "$1")
    .replace(/,([)\]}])/g, "$1")
    .trim()

function scriptKind(file) {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX
  if (/\.[cm]?ts$/.test(file)) return ts.ScriptKind.TS
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

function chainOf(node) {
  const names = []
  let at = node
  for (;;) {
    if (ts.isPropertyAccessExpression(at)) {
      names.unshift(at.name.text)
      at = at.expression
    } else if (ts.isCallExpression(at)) {
      at = at.expression
    } else if (ts.isElementAccessExpression(at)) {
      at = at.expression
    } else if (ts.isNonNullExpression(at) || ts.isParenthesizedExpression(at)) {
      at = at.expression
    } else break
  }
  return { root: ts.isIdentifier(at) ? at.text : null, names }
}

function isInnerLink(node) {
  const parent = node.parent
  if (!parent) return false
  if (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isElementAccessExpression(parent)) &&
    parent.expression === node
  )
    return true
  return ts.isCallExpression(parent) && parent.expression === node
}

function bindings(source) {
  const asserting = new Set(ALWAYS_ASSERTING)
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const from = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (!clause) continue
    const fromAssert = ASSERT_MODULE.test(from)
    const fromExpect = EXPECT_MODULES.has(from)
    if (!fromAssert && !fromExpect) continue
    if (clause.name && fromAssert) asserting.add(clause.name.text)
    const named = clause.namedBindings
    if (named && ts.isNamespaceImport(named) && fromAssert)
      asserting.add(named.name.text)
    if (named && ts.isNamedImports(named))
      for (const element of named.elements) {
        const imported = (element.propertyName ?? element.name).text
        if (fromAssert || ALWAYS_ASSERTING.has(imported))
          asserting.add(element.name.text)
      }
  }
  return asserting
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    node.parent &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  )
    return node.parent.name.text
  return null
}

function isAssertCall(node, asserting, helpers) {
  if (!ts.isCallExpression(node) || isInnerLink(node)) return false
  const { root, names } = chainOf(node.expression)
  if (!root) return false
  if (asserting.has(root)) return true
  if (names[0] === "assert") return true
  return names.length === 0 && helpers.has(root)
}

function assertingHelpers(source, asserting) {
  const bodies = []
  const visit = (node) => {
    const name = functionName(node)
    if (name) bodies.push({ name, node })
    ts.forEachChild(node, visit)
  }
  visit(source)
  const helpers = new Set()
  let grew = true
  while (grew) {
    grew = false
    for (const { name, node } of bodies) {
      if (helpers.has(name)) continue
      let found = false
      const look = (inner) => {
        if (found) return
        if (isAssertCall(inner, asserting, helpers)) found = true
        else ts.forEachChild(inner, look)
      }
      ts.forEachChild(node, look)
      if (found) {
        helpers.add(name)
        grew = true
      }
    }
  }
  return helpers
}

function titleOf(arg, source) {
  if (!arg) return "(untitled)"
  if (ts.isStringLiteralLike(arg)) return arg.text
  return normalise(arg.getText(source))
}

function optionMarks(args) {
  const marks = []
  for (const arg of args) {
    if (!ts.isObjectLiteralExpression(arg)) continue
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name))
        continue
      const name = prop.name.text
      if (!OPTION_MARKS.has(name)) continue
      if (prop.initializer.kind === ts.SyntaxKind.FalseKeyword) continue
      marks.push(MARKS[name])
    }
  }
  return marks
}

function caseCall(node) {
  if (!ts.isCallExpression(node) || isInnerLink(node)) return null
  const { root, names } = chainOf(node.expression)
  if (!root || !CASE_APIS.has(root)) return null
  if (names.some((name) => NOT_A_CASE.has(name))) return null
  if (names.includes("step")) return { group: true, marks: [] }
  const group = GROUP_NAMES.has(root) || names.some((n) => GROUP_NAMES.has(n))
  const marks = names.filter((name) => name in MARKS).map((n) => MARKS[n])
  return { group, marks: [...marks, ...optionMarks(node.arguments.slice(1))] }
}

function tableOf(node) {
  let at = node
  while (
    at &&
    (ts.isAsExpression(at) ||
      ts.isSatisfiesExpression(at) ||
      ts.isParenthesizedExpression(at) ||
      (ts.isCallExpression(at) &&
        chainOf(at.expression).names.at(-1) === "freeze"))
  )
    at = ts.isCallExpression(at) ? at.arguments[0] : at.expression
  return at && ts.isArrayLiteralExpression(at) ? at : null
}

function eachTable(node) {
  if (!ts.isCallExpression(node)) return null
  const callee = node.expression
  if (!ts.isCallExpression(callee)) return null
  const { root, names } = chainOf(callee.expression)
  if (!CASE_APIS.has(root) || names.at(-1) !== "each") return null
  return tableOf(callee.arguments[0])
}

function literalsOf(node, source) {
  const out = []
  const visit = (at) => {
    if (ts.isStringLiteralLike(at)) out.push(JSON.stringify(at.text))
    else if (ts.isTemplateExpression(at)) {
      out.push(JSON.stringify(at.head.text))
      for (const span of at.templateSpans) {
        visit(span.expression)
        out.push(JSON.stringify(span.literal.text))
      }
      return
    } else if (ts.isNumericLiteral(at) || ts.isBigIntLiteral(at))
      out.push(String(Number(at.text.replace(/[_n]/g, ""))))
    else if (ts.isRegularExpressionLiteral(at)) out.push(at.text)
    else if (at.kind === ts.SyntaxKind.TrueKeyword) out.push("true")
    else if (at.kind === ts.SyntaxKind.FalseKeyword) out.push("false")
    else if (at.kind === ts.SyntaxKind.NullKeyword) out.push("null")
    else if (ts.isIdentifier(at) && at.text === "undefined")
      out.push("undefined")
    else if (
      ts.isPrefixUnaryExpression(at) &&
      at.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(at.operand)
    ) {
      out.push(String(-Number(at.operand.text.replace(/_/g, ""))))
      return
    }
    ts.forEachChild(at, visit)
  }
  visit(node)
  return out
}

export function meaningOf(call, source) {
  const { root, names } = chainOf(call.expression)
  return `${root}.${names.join(".")}|${literalsOf(call, source).join("\u0001")}`
}

export function parseTests(file, text) {
  const source = ts.createSourceFile(
    file,
    String(text),
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file)
  )
  const asserting = bindings(source)
  const helpers = assertingHelpers(source, asserting)
  const cases = new Map()
  const tables = new Map()
  const bounds = new Map()
  const unique = (key, map) => {
    let name = key
    for (let n = 2; map.has(name); n++) name = `${key} #${n}`
    return name
  }
  const entry = (key, title, marks) => {
    const name = unique(key, cases)
    const made = { key: name, title, marks: new Set(marks), assertions: [] }
    cases.set(name, made)
    return made
  }
  const scopes = [{ path: [], marks: [], into: null }]
  const top = () => scopes.at(-1)
  const holder = () => {
    const scope = top()
    if (scope.into) return scope.into
    const key = [...scope.path, "(setup)"].join(" > ")
    scope.into = cases.get(key) ?? entry(key, "(setup)", scope.marks)
    return scope.into
  }
  const addTable = (name, array) => {
    tables.set(
      unique(name, tables),
      array.elements.map((element) => normalise(element.getText(source)))
    )
  }
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      const name = decl.name.text
      const table = tableOf(decl.initializer)
      if (table) addTable(name, table)
      if (ts.isNumericLiteral(decl.initializer)) {
        const direction = BOUND_DOWN.test(name)
          ? "down"
          : BOUND_UP.test(name)
            ? "up"
            : null
        if (direction)
          bounds.set(name, {
            value: Number(decl.initializer.text.replace(/_/g, "")),
            direction,
          })
      }
    }
  }
  const visit = (node) => {
    const found = caseCall(node)
    if (found) {
      const scope = top()
      const title = titleOf(node.arguments[0], source)
      const marks = [...scope.marks, ...found.marks]
      const path = [...scope.path, title]
      const table = eachTable(node)
      if (table) addTable(path.join(" > "), table)
      if (found.group) {
        scopes.push({ path, marks, into: null })
        ts.forEachChild(node, visit)
        scopes.pop()
      } else {
        const made = entry(path.join(" > "), title, marks)
        scopes.push({ path, marks, into: made })
        ts.forEachChild(node, visit)
        scopes.pop()
      }
      return
    }
    if (isAssertCall(node, asserting, helpers)) {
      const call = node
      const { root } = chainOf(call.expression)
      const first = call.arguments[0]
      let target = root
      let at = call.expression
      while (at && !ts.isIdentifier(at)) {
        if (
          ts.isCallExpression(at) &&
          ts.isIdentifier(at.expression) &&
          at.arguments[0]
        )
          target = `${root}(${normalise(at.arguments[0].getText(source))})`
        at = at.expression
      }
      if (target === root && first)
        target = `${normalise(call.expression.getText(source))}(${normalise(first.getText(source))})`
      holder().assertions.push({
        text: normalise(call.getText(source)),
        meaning: meaningOf(call, source),
        target,
      })
      return
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(source, visit)
  for (const [key, made] of cases)
    if (made.title === "(setup)" && made.assertions.length === 0)
      cases.delete(key)
  return { cases, tables, bounds }
}
