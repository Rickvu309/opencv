import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function pagedRead(node, source) {
  if (!ts.isCallExpression(node)) return false
  const name = node.expression.getText(source)
  return (
    ["readWordPackage", "readWordParagraphs"].includes(name) ||
    (name.endsWith(".read") && node.arguments[0]?.text === "paper.read")
  )
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  walk(source, (node) => {
    if (!ts.isFunctionLike(node) || !node.body) return
    const reads = []
    let consumesText = false
    let followsCursor = false
    walk(node.body, (child) => {
      if (pagedRead(child, source)) reads.push(child)
      if (
        ts.isPropertyAccessExpression(child) &&
        ["regions", "paragraphs"].includes(child.name.text)
      )
        consumesText = true
      if (
        ts.isForStatement(child) ||
        ts.isWhileStatement(child) ||
        ts.isDoStatement(child) ||
        ts.isForOfStatement(child)
      ) {
        walk(child.statement, (part) => {
          if (!pagedRead(part, source)) return
          for (const arg of part.arguments) {
            if (
              ts.isObjectLiteralExpression(arg) &&
              arg.properties.some(
                (prop) =>
                  ts.isPropertyAssignment(prop) &&
                  prop.name.getText(source) === "cursor" &&
                  prop.initializer.getText(source).includes("nextCursor")
              )
            )
              followsCursor = true
          }
        })
      }
    })
    if (reads.length && consumesText && !followsCursor)
      problems.push({
        kind: "single-page-document-context",
        line:
          source.getLineAndCharacterOfPosition(reads[0].getStart(source)).line +
          1,
      })
  })
  return problems
}
