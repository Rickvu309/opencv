import ts from "typescript"

export function detect(text, file = "http.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const hit = (node, kind) =>
    hits.push({
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      kind,
    })
  const nodes = []
  function visit(node) {
    nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  const parseCall = (node) =>
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "parse" &&
    ts.isPropertyAccessExpression(node.expression.expression) &&
    node.expression.expression.name.text === "publicResult"
  if (file.endsWith("catalog-publication.ts")) {
    const method = nodes.find(
      (node) =>
        ts.isMethodDeclaration(node) &&
        node.name.getText(source) === "publicOutput"
    )
    if (
      !method ||
      !nodes.some(
        (node) =>
          node.pos >= method.pos && node.end <= method.end && parseCall(node)
      )
    )
      hits.push({
        line: 1,
        kind: "private-command-result-without-public-schema",
      })
    return hits
  }
  if (file.endsWith("bind.ts")) {
    if (
      !nodes.some(
        (node) =>
          parseCall(node) &&
          node.arguments.some(
            (argument) =>
              ts.isAwaitExpression(argument) &&
              ts.isCallExpression(argument.expression) &&
              argument.expression.expression.getText(source) ===
                "binding.execute"
          )
      )
    )
      hits.push({ line: 1, kind: "private-read-result-without-public-schema" })
    return hits
  }
  const formatter = nodes.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "untrustedResult"
  )
  if (!formatter)
    hits.push({ line: 1, kind: "missing-untrusted-result-envelope" })
  const objects = nodes.filter(
    (node) =>
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(source) === "trust"
      )
  )
  const envelope = objects.find(
    (node) =>
      formatter && node.pos >= formatter.pos && node.end <= formatter.end
  )
  const property = (name) =>
    envelope?.properties.find(
      (node) =>
        ts.isPropertyAssignment(node) && node.name.getText(source) === name
    )
  const trust = property("trust")
  const prefix = property("untrustedData")
  if (
    !trust ||
    !ts.isStringLiteral(trust.initializer) ||
    trust.initializer.text !== "untrusted"
  )
    hits.push({ line: 1, kind: "missing-untrusted-trust-value" })
  if (
    !prefix ||
    !ts.isStringLiteral(prefix.initializer) ||
    !prefix.initializer.text.startsWith("Untrusted data:")
  )
    hits.push({ line: 1, kind: "missing-untrusted-data-prefix" })
  if (envelope) {
    const spread = envelope.properties.find(ts.isSpreadAssignment)
    if (
      spread &&
      (!prefix || prefix.pos > spread.pos || !trust || trust.pos < spread.pos)
    )
      hit(envelope, "untrusted-envelope-order")
  }
  for (const node of nodes) {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "content" &&
      (!formatter || node.pos < formatter.pos || node.end > formatter.end)
    )
      hit(node, "bare-tool-result")
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "registerTool"
    ) {
      const callback = node.arguments[2]
      const check = (child) => {
        if (child !== callback && ts.isFunctionLike(child)) return
        if (ts.isReturnStatement(child) && child.expression) {
          let wrapped = false
          const find = (value) => {
            if (
              ts.isCallExpression(value) &&
              value.expression.getText(source) === "untrustedResult"
            )
              wrapped = true
            ts.forEachChild(value, find)
          }
          find(child.expression)
          if (!wrapped) hit(child, "tool-result-bypasses-envelope")
        }
        ts.forEachChild(child, check)
      }
      if (callback) check(callback)
    }
  }
  return hits
}
