import ts from "typescript"

const IMPORT_OPERATION = "@workspace/domain/operations/paper/import"
const OLDER_WRITERS = new Set(["createPaper", "importPaper"])

function functionName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  )
    return node.parent.name.text
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name))
    return node.name.text
  return null
}

function writesOlderDocument(node) {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  if (ts.isIdentifier(callee) && OLDER_WRITERS.has(callee.text)) return true
  return (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === "insert" &&
    node.arguments.some(
      (argument) => ts.isIdentifier(argument) && argument.text === "paperDocs"
    )
  )
}

function bindsImportOperation(source) {
  return source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === IMPORT_OPERATION
  )
}

export function detectImportBlockPaper(text, path = "source.ts") {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const binding = bindsImportOperation(source)
  const findings = []
  const visit = (node, importer) => {
    const name = functionName(node)
    const inside = importer ?? (name && /import/i.test(name) ? name : null)
    if ((inside || binding) && writesOlderDocument(node)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      findings.push({
        path,
        line: line + 1,
        message: `${inside ?? "the paper.import binding"} creates an older block document; an import must stage and publish a Word page`,
      })
    }
    ts.forEachChild(node, (child) => visit(child, inside))
  }
  visit(source, null)
  return findings
}
