import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

const path = (node) =>
  ts.isIdentifier(node)
    ? node.text
    : ts.isPropertyAccessExpression(node)
      ? `${path(node.expression)}.${node.name.text}`
      : ""

function has(root, predicate) {
  let found = false
  walk(root, (node) => {
    if (predicate(node)) found = true
  })
  return found
}

const call = (node, name, args) =>
  ts.isCallExpression(node) &&
  path(node.expression) === name &&
  (!args || node.arguments.map(path).join(",") === args.join(","))

function number(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AsteriskToken
  )
    return number(node.left) * number(node.right)
  return NaN
}

function refuses(node) {
  return (
    ts.isReturnStatement(node) &&
    node.expression &&
    call(node.expression, "packageFailure")
  )
}

function alternatives(node) {
  if (ts.isParenthesizedExpression(node)) return alternatives(node.expression)
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.BarBarToken
  )
    return [...alternatives(node.left), ...alternatives(node.right)]
  return [node]
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const functions = new Map()
  let limits = false
  walk(source, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body)
      functions.set(node.name.text, node)
    if (
      ts.isVariableDeclaration(node) &&
      path(node.name) === "retentionLimits" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const properties = new Map(
        node.initializer.properties
          .filter(ts.isPropertyAssignment)
          .map((property) => [
            path(property.name),
            number(property.initializer),
          ])
      )
      limits =
        properties.get("count") > 0 &&
        properties.get("count") <= 64 &&
        properties.get("bytes") > 0 &&
        properties.get("bytes") <= 64 * 1024 * 1024
    }
  })
  const prepare = functions.get("prepareStoredWordPackage")
  if (!prepare) return []
  const problems = []
  const add = (kind) =>
    problems.push({
      kind,
      line: source.getLineAndCharacterOfPosition(prepare.getStart()).line + 1,
    })
  const capacity = functions.get("requireCandidateCapacity")
  if (!limits || !capacity) {
    add("candidate-retention-capacity")
    return problems
  }
  const first = capacity.body.statements[0]
  const locked =
    first &&
    has(
      first,
      (node) =>
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "for" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === "no key update" &&
        has(node, (child) => call(child, "eq", ["user.id", "owner"]))
    )
  if (!locked) add("candidate-retention-owner-lock")
  if (
    !has(capacity, (node) =>
      call(node, "pruneUnreachableCandidates", ["owner"])
    )
  )
    add("candidate-retention-prune")
  const refusal = has(
    capacity,
    (node) =>
      ts.isIfStatement(node) &&
      refuses(node.thenStatement) &&
      alternatives(node.expression).some(
        (child) =>
          ts.isBinaryExpression(child) &&
          path(child.left) === "usage.count" &&
          child.operatorToken.kind === ts.SyntaxKind.GreaterThanEqualsToken &&
          path(child.right) === "retentionLimits.count"
      ) &&
      alternatives(node.expression).some(
        (child) =>
          ts.isBinaryExpression(child) &&
          path(child.left) === "usage.bytes" &&
          child.operatorToken.kind === ts.SyntaxKind.GreaterThanToken &&
          path(child.right) === "retentionLimits.bytes"
      )
  )
  const charged =
    has(capacity, (node) => call(node, "count")) &&
    has(capacity, (node) =>
      call(node, "eq", ["paperPackageCandidates.userId", "owner"])
    ) &&
    has(
      capacity,
      (node) =>
        ts.isTaggedTemplateExpression(node) &&
        path(node.tag) === "sql" &&
        [
          "forward.byteSize",
          "restore.byteSize",
          "paperPackageCandidates.seal",
          "forward.sidecar",
          "forward.projection",
          "restore.sidecar",
          "restore.projection",
          "packageBytes",
        ].every((name) => has(node, (child) => path(child) === name)) &&
        has(node, (child) => call(child, "JSON.stringify", ["material"]))
    )
  if (!refusal || !charged) add("candidate-retention-capacity")
  const guarded = has(
    prepare,
    (node) =>
      call(node, "transaction") &&
      node.arguments.some((argument) => {
        if (!ts.isArrowFunction(argument) || !ts.isBlock(argument.body))
          return false
        const statement = argument.body.statements[0]
        if (
          !statement ||
          !ts.isExpressionStatement(statement) ||
          !ts.isAwaitExpression(statement.expression)
        )
          return false
        const invoked = statement.expression.expression
        if (!call(invoked, "requireCandidateCapacity")) return false
        const [ownerArg, bytes, material] = invoked.arguments
        const added =
          bytes &&
          ts.isBinaryExpression(bytes) &&
          bytes.operatorToken.kind === ts.SyntaxKind.PlusToken &&
          [path(bytes.left), path(bytes.right)].sort().join("+") ===
            "seal.forward.byteSize+seal.restore.byteSize"
        const parts =
          material && ts.isArrayLiteralExpression(material)
            ? material.elements.map(path)
            : []
        return (
          path(ownerArg) === "owner" &&
          added &&
          [
            "seal",
            "plan.candidate.sidecar",
            "plan.candidate.projection",
            "sidecar",
            "projection",
          ].every((name) => parts.includes(name))
        )
      })
  )
  if (!guarded) add("candidate-retention-before-insert")
  return problems
}
