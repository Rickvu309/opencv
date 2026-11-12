import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function calls(node, source, test) {
  const found = []
  walk(node, (child) => {
    if (ts.isCallExpression(child) && test(child.expression.getText(source)))
      found.push(child)
  })
  return found
}

function openedNames(body, source) {
  const names = []
  walk(body, (child) => {
    if (
      ts.isVariableDeclaration(child) &&
      ts.isIdentifier(child.name) &&
      child.initializer &&
      ts.isAwaitExpression(child.initializer) &&
      ts.isCallExpression(child.initializer.expression) &&
      child.initializer.expression.expression.getText(source) ===
        "PaperPackage.open"
    )
      names.push({ name: child.name.text, end: child.end })
  })
  return names
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  walk(source, (node) => {
    if (!ts.isFunctionLike(node) || !node.body) return
    const writes = calls(node.body, source, (name) => name === "mutateWord")
    if (writes.length === 0) return
    const opened = openedNames(node.body, source)
    for (const write of writes) {
      const checked = opened.some(
        ({ name, end }) =>
          end < write.getStart(source) &&
          calls(
            node.body,
            source,
            (callee) => callee === `${name}.readOnly`
          ).some(
            (check) =>
              check.getStart(source) > end &&
              check.getStart(source) < write.getStart(source)
          )
      )
      if (!checked)
        problems.push({
          kind: "unchecked-read-only-package",
          line:
            source.getLineAndCharacterOfPosition(write.getStart(source)).line +
            1,
        })
    }
  })
  return problems
}
