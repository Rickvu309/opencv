import ts from "typescript"

export function detect(text, file = "source.tsx") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const problems = []
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === "className" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const classes = new Set(node.initializer.text.split(/\s+/))
      if (classes.has("rich-paper-page") && !classes.has("min-w-0"))
        problems.push({
          kind: "paper-page-keeps-document-minimum-width",
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
