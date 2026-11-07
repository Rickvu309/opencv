import ts from "typescript"

const parse = (file, text) =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

function walk(node, fnName, visit) {
  const name =
    ts.isFunctionLike(node) && node.name && ts.isIdentifier(node.name)
      ? node.name.text
      : fnName
  visit(node, name)
  ts.forEachChild(node, (child) => walk(child, name, visit))
}

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart()).line + 1

function callName(node) {
  if (!ts.isCallExpression(node)) return null
  const expr = node.expression
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text
  return null
}

function keysOf(node) {
  if (!ts.isObjectLiteralExpression(node)) return null
  const keys = []
  for (const prop of node.properties) {
    if (
      (ts.isPropertyAssignment(prop) ||
        ts.isShorthandPropertyAssignment(prop)) &&
      ts.isIdentifier(prop.name)
    )
      keys.push(prop.name.text)
  }
  return keys
}

export function detect(text, file = "source.ts") {
  const source = parse(file, String(text))
  const problems = []
  walk(source, "", (node, fnName) => {
    if (!ts.isCallExpression(node)) return
    const name = callName(node)
    const keys = node.arguments[0] ? keysOf(node.arguments[0]) : null
    if (!keys) return
    if (name === "createProposal" && !keys.includes("basisRevision"))
      problems.push({ kind: "missing-basis", line: lineOf(source, node) })
    if (
      name === "execute" &&
      fnName === "approve" &&
      !keys.includes("expectedRevision")
    )
      problems.push({ kind: "unchecked-approval", line: lineOf(source, node) })
  })
  return problems
}
