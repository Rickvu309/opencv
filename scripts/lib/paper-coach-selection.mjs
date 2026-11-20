import ts from "typescript"

export function detectCoachSelection(text, path) {
  const files = {
    "apps/api/src/paper/content-coach.ts":
      "Undo must route by the saved document format, never writer capabilities",
    "apps/api/src/coach/context.ts":
      "Focused Paper grounding must carry selected blockIds",
    "apps/api/src/coach/task-runtime.ts":
      "Saved Coach tasks must pass selected blockIds to the fake intent",
    "apps/api/src/coach/fake.ts":
      "An unresolved selected passage must refuse instead of falling back to another paragraph",
  }
  if (!files[path]) return []
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = new Set()
  function visit(node) {
    if (
      path.endsWith("content-coach.ts") &&
      ts.isIfStatement(node) &&
      node.expression.getText(source).includes("supportedSchemaRevisions")
    )
      hits.add(files[path])
    if (
      path.endsWith("context.ts") &&
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "paperFocus" &&
      node.arguments[2]?.getText(source) === "paperId" &&
      node.arguments.length < 4
    )
      hits.add(files[path])
    if (
      path.endsWith("task-runtime.ts") &&
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "fakePaperIntent" &&
      node.arguments.length < 2
    )
      hits.add(files[path])
    if (
      path.endsWith("fake.ts") &&
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      node.left.getText(source).includes(".selected") &&
      node.right.getText(source).includes("paragraph")
    )
      hits.add(files[path])
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...hits]
}
