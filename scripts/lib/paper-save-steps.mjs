import ts from "typescript"

export function detectPaperSaveCommandReplay(text, file = "save.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "run" &&
      node.arguments.some(
        (arg) =>
          ts.isPropertyAccessExpression(arg) && arg.name.text === "commands"
      )
    ) {
      problems.push("Validate person save steps through the Paper log")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
