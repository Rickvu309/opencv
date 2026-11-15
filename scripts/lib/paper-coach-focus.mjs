import ts from "typescript"

export function detectLetterCoachFocus(text) {
  const source = ts.createSourceFile(
    "letter.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "PaperLetterEditor"
    ) {
      let held = false
      const inspect = (child) => {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text === "useEffect"
        ) {
          const effect = child.arguments[0]
          if (
            effect &&
            ts.isArrowFunction(effect) &&
            ts.isCallExpression(effect.body) &&
            ts.isIdentifier(effect.body.expression) &&
            effect.body.expression.text === "holdWritingCoachFocus"
          )
            held = true
        }
        ts.forEachChild(child, inspect)
      }
      inspect(node)
      if (!held)
        hits.push("the open Letter must hold and release its Coach focus")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
