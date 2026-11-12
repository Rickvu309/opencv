import ts from "typescript"

function propertyNamed(object, name) {
  return object.properties.find(
    (property) =>
      (ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property)) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name
  )
}

function startsLetter(object) {
  const kind = propertyNamed(object, "kind")
  return (
    !!kind &&
    ts.isPropertyAssignment(kind) &&
    ts.isStringLiteral(kind.initializer) &&
    kind.initializer.text === "letter" &&
    !propertyNamed(object, "templateId")
  )
}

export function detectWebBlockCv(text, path = "source.tsx") {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "paper.create"
    ) {
      const input = node.arguments[1]
      if (
        !input ||
        !ts.isObjectLiteralExpression(input) ||
        !startsLetter(input)
      )
        hits.push({
          path,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          message:
            "The web starts a CV on the Word writing page with paper.canvas mint, never an older block CV through paper.create",
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
