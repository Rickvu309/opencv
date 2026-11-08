import ts from "typescript"

const commitPattern = /\b[0-9a-f]{7,40}\b/g
const ledgerFile = (file) => /^scripts\/guard-ledger\/[^/]+\.json$/.test(file)

function testReferences(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const bindings = new Map()
  const explicit = new Set()
  let readsHistory = false
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
      bindings.set(node.name.text, node.initializer)
    ts.forEachChild(node, collect)
  }
  collect(source)
  const value = (node, seen = new Set()) => {
    if (!node) return ""
    if (ts.isStringLiteralLike(node)) return node.text
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      seen.add(node.text)
      return value(bindings.get(node.text), seen)
    }
    if (ts.isTemplateExpression(node))
      return (
        node.head.text +
        node.templateSpans
          .map(
            (span) => value(span.expression, new Set(seen)) + span.literal.text
          )
          .join("")
      )
    return ""
  }
  const visit = (node) => {
    if (ts.isCallExpression(node))
      for (const arg of node.arguments)
        if (
          ts.isArrayLiteralExpression(arg) &&
          value(arg.elements[0]) === "show"
        ) {
          readsHistory = true
          for (const ref of arg.elements.slice(1)) {
            const match = /^([0-9a-f]{7,40})(?=:|$)/.exec(value(ref))
            if (match) explicit.add(match[1])
          }
        }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { explicit: [...explicit], readsHistory }
}

export function pinnedCommits(source, file = "") {
  if (ledgerFile(file)) {
    const historic = JSON.parse(source).historic
    return [
      ...new Set(
        [historic?.sha, historic?.fix, historic?.fixed?.rev].filter(
          (rev) => rev && rev !== "HEAD"
        )
      ),
    ]
  }
  if (!/["']show["']/.test(source)) return []
  const refs = testReferences(source, file)
  return refs.readsHistory
    ? [...new Set([...refs.explicit, ...(source.match(commitPattern) ?? [])])]
    : []
}

export function commitsMissingFromMain(source, isCommit, isOnMain, file = "") {
  const explicit = ledgerFile(file)
    ? null
    : testReferences(source, file).explicit
  return pinnedCommits(source, file).filter((candidate) =>
    ledgerFile(file) || explicit.includes(candidate)
      ? !isCommit(candidate) || !isOnMain(candidate)
      : isCommit(candidate) && !isOnMain(candidate)
  )
}
