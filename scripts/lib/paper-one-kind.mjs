import ts from "typescript"

export const OLDER_LOOKUPS = ["ownedPaper", "ownedPaperOrNull"]

export const BLOCK_DOCUMENT_ONLY = {}

function calls(node) {
  const names = new Set()
  function visit(child) {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression))
      names.add(child.expression.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

function takesDocId(node) {
  return node.parameters.some(
    (parameter) =>
      ts.isIdentifier(parameter.name) && parameter.name.text === "docId"
  )
}

export function detect(
  source,
  file = "store.ts",
  exempt = BLOCK_DOCUMENT_ONLY
) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  return ast.statements.flatMap((node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return []
    const name = node.name.text
    if (!takesDocId(node) || name in exempt || OLDER_LOOKUPS.includes(name))
      return []
    const called = [...calls(node.body)]
    const older = called.some((callee) => OLDER_LOOKUPS.includes(callee))
    const word = called.some((callee) => /Word|Package/.test(callee))
    if (!older || word) return []
    return [
      {
        kind: "paper-document-command-reads-one-kind",
        name,
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      },
    ]
  })
}

export function docIdFunctions(source, file = "store.ts") {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  return ast.statements.flatMap((node) =>
    ts.isFunctionDeclaration(node) && node.name && takesDocId(node)
      ? [node.name.text]
      : []
  )
}
