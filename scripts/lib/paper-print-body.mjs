import ts from "typescript"

const STAND_IN_BODIES = new Set(["blankCv", "blankLetter"])

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function callsStandIn(node) {
  let found = false
  walk(node, (child) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      STAND_IN_BODIES.has(child.expression.text)
    )
      found = true
  })
  return found
}

function propertyNamed(literal, name) {
  return literal.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name
  )
}

function marksWord(literal) {
  const format = propertyNamed(literal, "format")
  return Boolean(
    format &&
    ts.isStringLiteral(format.initializer) &&
    format.initializer.text === "word"
  )
}

function parsesView(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "parse" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "paperViewSchema"
  )
}

function gatedByPrintBody(node) {
  for (let at = node.parent; at; at = at.parent) {
    const condition = ts.isConditionalExpression(at)
      ? at.condition
      : ts.isIfStatement(at)
        ? at.expression
        : ts.isBinaryExpression(at) &&
            at.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
          ? at.left
          : null
    if (condition) {
      let gated = false
      walk(condition, (child) => {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text === "hasPrintBody"
        )
          gated = true
      })
      if (gated) return true
    }
    if (ts.isFunctionLike(at)) return false
  }
  return false
}

export function detect(text, file = "source.tsx") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const problems = []
  const add = (node, kind) =>
    problems.push({
      kind,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    })
  walk(source, (node) => {
    if (parsesView(node)) {
      const [view] = node.arguments
      if (!view || !ts.isObjectLiteralExpression(view)) return
      const body = propertyNamed(view, "paper")
      if (body && callsStandIn(body.initializer) && !marksWord(view))
        add(node, "word-page-listed-with-print-body")
    }
    const label = ts.isStringLiteral(node)
      ? node.text
      : ts.isJsxText(node)
        ? node.text.trim()
        : null
    if (label === "Download PDF" && !gatedByPrintBody(node))
      add(node, "download-pdf-without-print-body")
  })
  return problems
}
