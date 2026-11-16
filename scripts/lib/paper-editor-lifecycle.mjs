import ts from "typescript"

export function detect(text, file = "rich-page.tsx") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const calls = []
  const strings = []
  function visit(node) {
    if (ts.isCallExpression(node)) calls.push(node)
    if (ts.isStringLiteral(node)) strings.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  const hasCall = (name) =>
    calls.some((node) => node.expression.getText(source).endsWith(name))
  const problems = []
  if (file.endsWith("rich-page.tsx") && !hasCall("mountRichEditorLifecycle"))
    problems.push("Paper must mount through the document lifecycle")
  if (file.endsWith("rich-editor-lifecycle.ts")) {
    for (const name of [
      ".onDocumentRelease",
      ".subscribe",
      ".captureSelection",
      ".restoreSelection",
      ".released",
    ])
      if (!hasCall(name)) problems.push(`Missing lifecycle operation ${name}`)
    const resetMount = calls.some(
      (node) =>
        node.expression.getText(source).endsWith(".subscribe") &&
        node.arguments.some(
          (argument) =>
            argument.getText(source).includes('change === "reset"') &&
            argument.getText(source).includes("mount()")
        )
    )
    if (!resetMount) problems.push("Canonical document resets must remount")
  }
  if (file.endsWith("editor.ts") && strings.includes("Paper editor is closed"))
    problems.push("Released editor handlers must be harmless")
  return problems
}
