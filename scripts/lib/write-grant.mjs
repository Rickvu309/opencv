import ts from "typescript"

const parse = (file, text) =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart()).line + 1

function propName(prop) {
  if (
    (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
    ts.isIdentifier(prop.name)
  )
    return prop.name.text
  return null
}

function hasProp(node, name) {
  let found = false
  walk(node, (child) => {
    if (propName(child) === name) found = true
  })
  return found
}

function callee(node) {
  if (!ts.isCallExpression(node)) return null
  const expr = node.expression
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text
  return null
}

function isSetCall(node) {
  return callee(node) === "set"
}

function callsAssert(fn) {
  let found = false
  const visit = (node) => {
    if (node !== fn && ts.isFunctionLike(node)) return
    if (callee(node) === "assertPriorityGrant") found = true
    ts.forEachChild(node, visit)
  }
  if (fn.body) visit(fn.body)
  return found
}

function grantParam(fn, source) {
  return (fn.parameters ?? []).some((param) =>
    (param.type?.getText(source) ?? "").includes("WriteGrant")
  )
}

function prioritySets(fn) {
  const hits = []
  const visit = (node) => {
    if (node !== fn && ts.isFunctionLike(node)) return
    if (
      isSetCall(node) &&
      node.arguments[0] &&
      hasProp(node.arguments[0], "priority")
    )
      hits.push(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  if (fn.body) visit(fn.body)
  return hits
}

export function detect(text, file = "source.ts") {
  const source = parse(file, String(text))
  const problems = []
  walk(source, (node) => {
    if (!ts.isFunctionLike(node) || !node.body) return
    const sets = prioritySets(node)
    if (sets.length === 0) return
    if (!grantParam(node, source))
      problems.push({ kind: "actor-only", line: lineOf(source, node) })
    if (!callsAssert(node))
      problems.push({ kind: "missing-assert", line: lineOf(source, node) })
    if (sets.some((set) => !hasProp(set, "priorityRevision")))
      problems.push({ kind: "missing-bump", line: lineOf(source, node) })
  })
  return problems
}

export function normalizeWrite(outcome) {
  return {
    call: "writePriority",
    grant: outcome.asserted ? "open" : "missing",
    owner: outcome.ownerMatched === false ? "other" : "same",
    entity: outcome.entityMatched === false ? "other" : "same",
    resource: outcome.resource ?? "job.priority",
    transaction: outcome.sameTransaction === false ? "other" : "same",
    transactionOpen: outcome.transactionOpen ?? true,
    bumped: outcome.revisionDelta === 1,
  }
}

export function traceProblems(trace) {
  const problems = []
  for (const event of trace) {
    if (event.call !== "writePriority") continue
    if (event.grant !== "open") problems.push({ kind: "grant" })
    if (event.owner !== "same") problems.push({ kind: "owner" })
    if (event.entity !== "same") problems.push({ kind: "entity" })
    if (event.resource !== "job.priority") problems.push({ kind: "resource" })
    if (event.transaction !== "same") problems.push({ kind: "transaction" })
    if (event.transactionOpen === false)
      problems.push({ kind: "closed-transaction" })
    if (event.bumped !== true) problems.push({ kind: "missing-bump" })
  }
  return problems
}
