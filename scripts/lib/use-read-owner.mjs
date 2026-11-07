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

function hasNonNull(node) {
  if (ts.isNonNullExpression(node)) return true
  let found = false
  ts.forEachChild(node, (child) => {
    if (!found && hasNonNull(child)) found = true
  })
  return found
}

function calls(node, name) {
  let found = false
  walk(node, (child) => {
    if (
      ts.isCallExpression(child) &&
      ((ts.isIdentifier(child.expression) && child.expression.text === name) ||
        (ts.isPropertyAccessExpression(child.expression) &&
          child.expression.name.text === name))
    )
      found = true
  })
  return found
}

function mentions(node, name) {
  let found = false
  walk(node, (child) => {
    if (ts.isIdentifier(child) && child.text === name) found = true
  })
  return found
}

function hasReturn(node) {
  let found = false
  walk(node, (child) => {
    if (ts.isReturnStatement(child)) found = true
  })
  return found
}

export function detect(text, file = "source.tsx") {
  const source = parse(file, String(text))
  const problems = []
  walk(source, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "useRead" &&
      node.arguments[0] &&
      hasNonNull(node.arguments[0])
    )
      problems.push({ kind: "use-read-non-null", line: lineOf(source, node) })
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "ownerId" &&
      node.initializer &&
      node.initializer.getText(source).includes("queryKey")
    )
      problems.push({ kind: "query-owner", line: lineOf(source, node) })
    if (!ts.isIfStatement(node) || !node.thenStatement) return
    if (!mentions(node.expression, "isCommandName")) return
    const block = node.thenStatement
    if (!calls(block, "refreshQueries") || !hasReturn(block)) return
    if (!calls(block, "refreshCatalogReads"))
      problems.push({ kind: "bridge-bypass", line: lineOf(source, node) })
  })
  return problems
}
