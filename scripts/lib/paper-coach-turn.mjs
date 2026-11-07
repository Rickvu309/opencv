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

export function detectPendingDeadline(text) {
  const source = sourceOf(text, "turn-compatibility.test.ts")
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "it" &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "sends a pending result the old tab can read"
    ) {
      let frozen = false
      let reading = false
      let cancelled = false
      const inspect = (child) => {
        if (
          ts.isCallExpression(child) &&
          ts.isPropertyAccessExpression(child.expression)
        ) {
          const method = child.expression.name.text
          if (
            method === "mockReturnValue" &&
            ts.isCallExpression(child.expression.expression)
          ) {
            const spy = child.expression.expression
            frozen ||=
              ts.isPropertyAccessExpression(spy.expression) &&
              spy.expression.name.text === "spyOn" &&
              ts.isIdentifier(spy.arguments[0]) &&
              spy.arguments[0].text === "Date" &&
              ts.isStringLiteral(spy.arguments[1]) &&
              spy.arguments[1].text === "now"
          }
          reading ||= method === "read"
          cancelled ||= method === "cancel"
        }
        ts.forEachChild(child, inspect)
      }
      inspect(node)
      if (!frozen || !reading || !cancelled)
        hits.push(
          "pending-result delivery needs a controlled deadline and an explicitly closed stream"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
