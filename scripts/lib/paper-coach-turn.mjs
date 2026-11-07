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
