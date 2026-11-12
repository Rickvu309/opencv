import ts from "typescript"

const OLDER_CREATE = new Set(["paper.create", "paper_create"])

function coachValue(entry) {
  const spec = entry.arguments[0]
  if (!spec || !ts.isObjectLiteralExpression(spec)) return null
  const coach = spec.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "coach"
  )
  return coach &&
    ts.isPropertyAssignment(coach) &&
    ts.isStringLiteral(coach.initializer)
    ? coach.initializer.text
    : null
}

function entryCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "commandEntry"
  )
}

export function detectCoachBlockPaper(text, path = "source.ts") {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const hits = []
  const hit = (node, message) =>
    hits.push({
      path,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      message,
    })
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      node.name.text === "paper.create"
    ) {
      if (
        entryCall(node.initializer) &&
        coachValue(node.initializer) !== "never"
      )
        hit(
          node,
          "paper.create makes an older block document; keep it coach never and let the Coach start Word pages with paper.start"
        )
    } else if (
      ts.isStringLiteralLike(node) &&
      OLDER_CREATE.has(node.text) &&
      !path.endsWith("paper-contract.ts")
    )
      hit(
        node,
        "The Coach starts a CV or Letter with paper.start, never the older block paper.create"
      )
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
