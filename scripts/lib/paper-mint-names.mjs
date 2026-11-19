import ts from "typescript"

export const message =
  "A Paper name never carries a file extension. Add .docx only where the download file name is built."

const EXTENSION = /\.(docx?|pdf|rtf|txt|odt)$/i

function namesPaper(name) {
  return /Name$/.test(name) && !/File[Nn]ame$/.test(name)
}

function namesTable(name) {
  return /_NAMES$/.test(name)
}

function literalEnd(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
  if (ts.isTemplateExpression(node))
    return node.templateSpans.at(-1)?.literal.text
  return null
}

function ownerName(node) {
  if (ts.isFunctionDeclaration(node) && node.name && namesPaper(node.name.text))
    return node.name.text
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    const name = node.name.text
    if (namesTable(name)) return name
    if (
      namesPaper(name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    )
      return name
  }
  return null
}

export function detect(text, file = "paper.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const findings = []
  const visit = (node, owner) => {
    const named = ownerName(node) ?? owner
    const end = named ? literalEnd(node) : null
    if (end !== null && EXTENSION.test(end))
      findings.push({
        kind: "paper-name-with-file-extension",
        name: named,
        line:
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      })
    ts.forEachChild(node, (child) => visit(child, named))
  }
  visit(source, null)
  return findings
}
