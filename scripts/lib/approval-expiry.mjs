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

function bodyOf(source, name) {
  let found = null
  walk(source, (node) => {
    if (
      found ||
      !ts.isFunctionLike(node) ||
      !node.body ||
      !node.name ||
      !ts.isIdentifier(node.name) ||
      node.name.text !== name
    )
      return
    found = node
  })
  return found
}

function problem(source, node) {
  return { kind: "app-clock-expiry", line: lineOf(source, node) }
}

export function detect(text, file = "source.ts") {
  const source = parse(file, String(text))
  const problems = []
  const lock = bodyOf(source, "lockProposal")
  if (lock) {
    const body = lock.body.getText(source)
    const lockedAt = body.indexOf("lockPending")
    const after = lockedAt === -1 ? "" : body.slice(lockedAt)
    const dbClock = /clock_timestamp\(\)/.test(after)
    const taskGate = /task\s*&&/.test(after)
    const appClock = /Date\.now|approvalExpired/.test(body)
    if (lockedAt === -1 || !dbClock || taskGate || appClock)
      problems.push(problem(source, lock))
  }
  const stale = bodyOf(source, "expireIfStale")
  if (stale && /Date\.now|approvalExpired/.test(stale.body.getText(source)))
    problems.push(problem(source, stale))
  return problems
}

export function replayExpiry(outcome) {
  const problems = []
  if (outcome.dbExpired && !outcome.refused)
    problems.push({ kind: "committed-expired" })
  if (outcome.dbExpired && outcome.priorityChanged)
    problems.push({ kind: "wrote-expired" })
  return problems
}
