import ts from "typescript"

export const OLDER_LOOKUPS = ["ownedPaper", "ownedPaperOrNull"]

export const BLOCK_DOCUMENT_ONLY = {
  setPaperTemplate:
    "templates style an older block document; a Word page keeps its own styles",
  setPaperStatus:
    "draft and ready status is stored on older block documents only",
  sharePaper: "share links render an older block document body",
  unsharePaper: "share links render an older block document body",
  dismissCheck: "layout checks run on older block documents only",
  keepTwoPages: "the page fitter works on older block documents only",
  attachPhoto: "the CV header photo belongs to an older block document",
  pageCount: "page counting measures an older block document layout",
}

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

export function detect(source, file = "store.ts") {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  return ast.statements.flatMap((node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return []
    const name = node.name.text
    if (
      !takesDocId(node) ||
      name in BLOCK_DOCUMENT_ONLY ||
      OLDER_LOOKUPS.includes(name)
    )
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
