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

export function detect(text, file = "source.ts") {
  const source = parse(file, String(text))
  const problems = []
  walk(source, (node) => {
    if (
      !ts.isFunctionLike(node) ||
      !node.body ||
      !node.name ||
      !ts.isIdentifier(node.name) ||
      node.name.text !== "lockProposal"
    )
      return
    const body = node.body.getText(source)
    const locked = body.indexOf("lockPending")
    const checked = body.indexOf("approvalExpired")
    if (locked !== -1 && (checked === -1 || checked < locked))
      problems.push({ kind: "expiry-before-lock", line: lineOf(source, node) })
  })
  return problems
}
