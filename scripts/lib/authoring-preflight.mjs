import ts from "typescript"

export function detect(source) {
  const ast = ts.createSourceFile(
    "authoring.mjs",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  return ast.statements.flatMap((node) => {
    if (
      !ts.isFunctionDeclaration(node) ||
      !["save", "takeInner", "finish"].includes(node.name?.text)
    )
      return []
    let validates = false
    function visit(child) {
      if (
        ts.isCallExpression(child) &&
        ts.isIdentifier(child.expression) &&
        child.expression.text === "validateAuthoring"
      )
        validates = true
      ts.forEachChild(child, visit)
    }
    visit(node)
    return validates
      ? []
      : [ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1]
  })
}
