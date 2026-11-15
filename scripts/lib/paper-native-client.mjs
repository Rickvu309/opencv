import ts from "typescript"

function hasProperty(node, name) {
  let found = false
  const visit = (child) => {
    if (
      (ts.isPropertyAssignment(child) ||
        ts.isShorthandPropertyAssignment(child)) &&
      child.name.getText() === name
    )
      found = true
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

export function detectNativeClientBasis(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = []
  if (/paperContract\s*\[\s*name\s*\]/.test(text))
    hits.push(
      "qualified read uses the command contract instead of query schemas"
    )
  const visit = (node) => {
    if (
      ts.isIfStatement(node) &&
      /name === [\'"]paper\.shared[\'"]/.test(
        node.expression.getText(source)
      ) &&
      /validateBasis\s*\(/.test(node.thenStatement.getText(source))
    )
      hits.push("public share requires owner edit authority")
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "coachPaperOptions" &&
      node.parameters.length
    )
      hits.push(
        "default Coach query accepts qualification as its query context"
      )
    if (ts.isFunctionDeclaration(node) && node.name?.text === "fakePaperEdit") {
      let proposal = false
      const find = (child) => {
        if (
          ts.isCallExpression(child) &&
          child.expression.getText(source).endsWith(".input.parse")
        ) {
          proposal = true
          const input = child.arguments[0]
          if (
            !input ||
            !hasProperty(input, "nativeBasis") ||
            !hasProperty(input, "writer")
          )
            hits.push("native proposal drops writer or nativeBasis")
        }
        ts.forEachChild(child, find)
      }
      find(node)
      if (!proposal) hits.push("native proposal parse is missing")
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "paperFocus") {
      const find = (child) => {
        if (
          ts.isReturnStatement(child) &&
          child.expression &&
          ts.isObjectLiteralExpression(child.expression) &&
          hasProperty(child.expression, "revision") &&
          !hasProperty(child.expression, "nativeBasis")
        )
          hits.push("native focus drops its outline basis")
        ts.forEachChild(child, find)
      }
      find(node)
      if (
        !/nativeBasisSchema\.parse\(outline\.nativeBasis\)/.test(
          node.getText(source)
        )
      )
        hits.push("native focus does not validate the outline basis")
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "contextSchema" &&
      /focusDoc/.test(node.getText(source)) &&
      !/nativeBasis:\s*nativeBasisSchema\.optional\(\)/.test(
        node.getText(source)
      )
    )
      hits.push("saved fake focus drops nativeBasis")
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
