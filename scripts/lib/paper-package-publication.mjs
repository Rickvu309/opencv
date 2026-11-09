import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const add = (node, kind) =>
    problems.push({
      kind,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    })
  walk(source, (node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return
    if (node.name.text !== "listWordPackages") return
    const fields = new Set([
      "docId",
      "revision",
      "name",
      "kind",
      "packageHash",
      "byteSize",
    ])
    let found = false
    walk(node.body, (child) => {
      if (
        !ts.isCallExpression(child) ||
        !ts.isPropertyAccessExpression(child.expression) ||
        child.expression.name.text !== "select"
      )
        return
      found = true
      const [selection] = child.arguments
      if (
        !selection ||
        !ts.isObjectLiteralExpression(selection) ||
        selection.properties.length !== fields.size ||
        selection.properties.some(
          (property) =>
            !ts.isPropertyAssignment(property) ||
            !ts.isIdentifier(property.name) ||
            !fields.has(property.name.text) ||
            !ts.isPropertyAccessExpression(property.initializer) ||
            !ts.isIdentifier(property.initializer.expression) ||
            property.initializer.expression.text !== "paperPackageVersions" ||
            property.initializer.name.text !== property.name.text
        )
      )
        add(child, "whole-package-library-list")
    })
    if (!found) add(node, "whole-package-library-list")
  })
  return problems
}
