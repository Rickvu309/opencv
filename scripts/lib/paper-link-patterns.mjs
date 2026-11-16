import ts from "typescript"

function unsafeRepetition(literal) {
  const body = literal.slice(1, literal.lastIndexOf("/"))
  let inClass = false
  let repetitions = 0
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (char === "\\") {
      index += 1
      continue
    }
    if (char === "[") inClass = true
    if (char === "]") inClass = false
    if (inClass) continue
    if (body[index - 1] === ")" && "+*?{".includes(char)) return true
    const brace = char === "{" ? body.slice(index).match(/^\{\d+,\}/) : null
    if (char !== "+" && char !== "*" && !brace) continue
    repetitions += 1
    if (body[index - 1] === ")" || repetitions > 1) return true
    if (brace) index += brace[0].length - 1
  }
  return false
}

export function detect(text) {
  const source = ts.createSourceFile(
    "rich-text.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isRegularExpressionLiteral(node) &&
      unsafeRepetition(node.getText(source))
    )
      hits.push(
        "Link patterns must use one repeated character class per regex; split address parts before validating"
      )
    ts.forEachChild(node, visit)
  }
  for (const statement of source.statements) {
    const names = ts.isFunctionDeclaration(statement)
      ? (statement.name?.text ?? "")
      : ts.isVariableStatement(statement)
        ? statement.declarationList.declarations
            .map((item) => item.name.getText(source))
            .join(" ")
        : ""
    if (/href|link|email|domain/i.test(names)) visit(statement)
  }
  return hits
}
