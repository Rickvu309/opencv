import ts from "typescript"

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
      hits.push({
        path,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        message:
          "The web starts a CV or Letter on the Word writing page with paper.canvas mint, never an older block document through paper.create",
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
