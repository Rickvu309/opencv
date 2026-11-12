import ts from "typescript"

function sourceOf(text, file) {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function propertyName(property) {
  return property.name && ts.isIdentifier(property.name)
    ? property.name.text
    : property.name && ts.isStringLiteral(property.name)
      ? property.name.text
      : null
}

function namesInside(node) {
  const names = new Set()
  const visit = (child) => {
    if (
      ts.isPropertyAssignment(child) ||
      ts.isShorthandPropertyAssignment(child)
    ) {
      const name = propertyName(child)
      if (name) names.add(name)
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

function isSetTextOp(literal) {
  return literal.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyName(property) === "op" &&
      ts.isStringLiteral(property.initializer) &&
      property.initializer.text === "setText"
  )
}

export function detectLeanlessCaret(text, file = "page.ts") {
  const source = sourceOf(text, file)
  const problems = []
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node) && isSetTextOp(node)) {
      const names = namesInside(node)
      if (names.has("caret") && !names.has("lean"))
        problems.push({
          kind: "caret-without-lean",
          file,
          line: lineOf(source, node),
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}

function isTrue(expression) {
  const inner = ts.isAsExpression(expression)
    ? expression.expression
    : expression
  return inner.kind === ts.SyntaxKind.TrueKeyword
}

const PAGE_SAID_HELD = /\.(?:held|editable)\b/

function guardedByPage(node, source) {
  let child = node
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isIfStatement(parent) &&
      parent.thenStatement === child &&
      PAGE_SAID_HELD.test(parent.expression.getText(source))
    )
      return true
    if (
      ts.isConditionalExpression(parent) &&
      parent.condition !== child &&
      PAGE_SAID_HELD.test(parent.condition.getText(source))
    )
      return true
    child = parent
  }
  return false
}

export function detectInventedHold(text, file = "page.ts") {
  const source = sourceOf(text, file)
  const problems = []
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node) === "held" &&
      isTrue(node.initializer) &&
      !guardedByPage(node, source)
    )
      problems.push({
        kind: "hold-the-page-did-not-ask-for",
        file,
        line: lineOf(source, node),
      })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
