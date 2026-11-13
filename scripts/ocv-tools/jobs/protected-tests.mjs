import { createRequire } from "node:module"

let ts = null

export function loadParser() {
  if (ts) return ts
  try {
    ts = createRequire(import.meta.url)("typescript")
  } catch (error) {
    throw new Error(
      `the TypeScript parser is not installed here (${String(error.message).split("\n")[0]}), so protected checks cannot be judged; run pnpm install, or read the guards job of ci`
    )
  }
  return ts
}

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

const EQUALS = new Set([
  "toBe",
  "toEqual",
  "toStrictEqual",
  "equal",
  "strictEqual",
  "deepEqual",
  "deepStrictEqual",
])
const ASSERT_ARITY = Object.freeze({
  ok: 1,
  fail: 0,
  ifError: 1,
  doesNotThrow: 1,
  doesNotReject: 1,
})
const sorted = (list) => [...list].sort()

function rootCall(call) {
  let at = call.expression
  let found = null
  for (;;) {
    if (ts.isCallExpression(at)) {
      found = at
      at = at.expression
    } else if (
      ts.isPropertyAccessExpression(at) ||
      ts.isElementAccessExpression(at) ||
      ts.isNonNullExpression(at) ||
      ts.isParenthesizedExpression(at)
    )
      at = at.expression
    else break
  }
  return found
}

export function meaningParts(call, source, asserting, helpers) {
  const { root, names } = chainOf(call.expression)
  const method = names.at(-1)
  const named = names.map((name) => (EQUALS.has(name) ? "eq" : name))
  const head = `${root}.${named.join(".")}`
  const literalsIn = (nodes) =>
    nodes.flatMap((node) => literalsOf(node, source))
  if (helpers.has(root) && names.length === 0)
    return { head, subject: [], expected: literalsIn(call.arguments) }
  const inner = rootCall(call)
  if (inner && inner !== call) {
    const outer = []
    let at = call
    while (at && at !== inner) {
      if (ts.isCallExpression(at)) outer.push(...at.arguments)
      at = at.expression
    }
    return {
      head,
      subject: literalsIn(inner.arguments.slice(0, 1)),
      expected: literalsIn(outer),
    }
  }
  const assertMethod =
    names.length === 0 ? (root === "assert" ? "ok" : root) : method
  const arity =
    names.length === 0 && !asserting.has(root)
      ? call.arguments.length
      : (ASSERT_ARITY[assertMethod] ?? 2)
  const args = call.arguments.slice(0, Math.max(arity, 0))
  return {
    head,
    subject: literalsIn(args.slice(0, 1)),
    expected: literalsIn(args.slice(1)),
  }
}

export const meaningText = ({ head, subject, expected }) =>
  `${head}|${sorted(subject).join("\u0001")}|${sorted(expected).join("\u0001")}`

export function meaningOf(call, source) {
  loadParser()
  return meaningText(
    meaningParts(call, source, new Set(ALWAYS_ASSERTING), new Set())
  )
}

function iteratedTable(call, resolve) {
  let at = call.parent
  while (at) {
    if (ts.isForOfStatement(at)) return resolve(at.expression)
    if (
      (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) &&
      at.parent &&
      ts.isCallExpression(at.parent) &&
      ts.isCallExpression(at.parent.expression) &&
      chainOf(at.parent.expression.expression).names.at(-1) === "each"
    )
      return resolve(at.parent.expression.arguments[0])
    at = at.parent
  }
  return null
}

export function parseTests(file, text, { tableRows = () => null } = {}) {
  loadParser()
  const source = ts.createSourceFile(
    file,
    String(text),
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file)
  )
  const asserting = bindings(source)
  const helpers = assertingHelpers(source, asserting)
  const localArrays = new Map()
  const importedFrom = new Map()
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const named = statement.importClause?.namedBindings
      if (named && ts.isNamedImports(named))
        for (const element of named.elements)
          importedFrom.set(element.name.text, {
            from: statement.moduleSpecifier.text,
            name: (element.propertyName ?? element.name).text,
          })
    }
    if (!ts.isVariableStatement(statement)) continue
    for (const decl of statement.declarationList.declarations)
      if (ts.isIdentifier(decl.name) && decl.initializer) {
        const array = tableOf(decl.initializer)
        if (array) localArrays.set(decl.name.text, array)
      }
  }
  const resolveTable = (expression) => {
    const array = tableOf(expression)
    if (array)
      return array.elements.map((element) => literalsOf(element, source))
    if (!expression || !ts.isIdentifier(expression)) return null
    const local = localArrays.get(expression.text)
    if (local)
      return local.elements.map((element) => literalsOf(element, source))
    const imported = importedFrom.get(expression.text)
    return imported ? tableRows(imported.from, imported.name) : null
  }
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
    if (ts.isThrowStatement(node) && node.expression && top().into) {
      top().into.assertions.push({
        text: normalise(node.getText(source)),
        meaning: `throw.||${sorted(literalsOf(node.expression, source)).join("\u0001")}`,
        rows: [],
        target: "throw",
      })
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
      const parts = meaningParts(call, source, asserting, helpers)
      const rows = iteratedTable(call, resolveTable)
      holder().assertions.push({
        text: normalise(call.getText(source)),
        meaning: meaningText(parts),
        rows: (rows ?? []).map(
          (row) =>
            `${parts.head}|*|${sorted([...parts.subject, ...parts.expected, ...row]).join("\u0001")}`
        ),
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

export function exportedTable(file, text, name) {
  loadParser()
  const source = ts.createSourceFile(
    file,
    String(text),
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file)
  )
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue
      const array = tableOf(decl.initializer)
      return array
        ? array.elements.map((element) => literalsOf(element, source))
        : null
    }
  }
  return null
}
