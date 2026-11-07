import ts from "typescript"

function sourceOf(text, path) {
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function stringText(node) {
  if (!node) return null
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isAsExpression(node)) return stringText(node.expression)
  return null
}

export function detectPaperEditApproval(text) {
  const source = sourceOf(text, "paper-contract.ts")
  const hits = []
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      node.name.text === "paper.edit" &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "commandEntry"
    ) {
      const arg = node.initializer.arguments[0]
      const coach =
        arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === "coach"
            )
          : null
      const value =
        coach && ts.isPropertyAssignment(coach)
          ? stringText(coach.initializer)
          : null
      if (value !== "confirm")
        hits.push("paper.edit must wait for the person before it writes")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

function returnsOf(node) {
  const values = []
  const walk = (child) => {
    if (ts.isReturnStatement(child)) {
      const value = stringText(child.expression)
      if (value) values.push(value)
    }
    ts.forEachChild(child, walk)
  }
  walk(node)
  return values
}

function callsNamed(node, name) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name
  )
    return true
  let found = false
  ts.forEachChild(node, (child) => {
    if (callsNamed(child, name)) found = true
  })
  return found
}

export function detectCoachTurnWire(text) {
  const source = sourceOf(text, "turn-compatibility.ts")
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "writeChatEvent" &&
      node.arguments.some((argument) =>
        callsNamed(argument, "toolResultFromExecute")
      )
    )
      hits.push(
        "A pending Coach result must be written as a turn event, without the command field the wire rejects"
      )
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

export function detectStalePaperBasis(text) {
  const source = sourceOf(text, "content-coach.ts")
  let refuses = false
  let consulted = false
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "stalePaperBasis")
      refuses = returnsOf(node).includes("refuse")
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "stalePaperBasis"
    )
      consulted = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return refuses && consulted
    ? []
    : [
        "A Coach Paper approval must refuse a stale basis and leave the bytes unchanged",
      ]
}
