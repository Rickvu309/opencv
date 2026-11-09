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

const value = (node) =>
  ts.isCallExpression(node)
    ? `${path(node.expression)}(${node.arguments.map(value).join(",")})`
    : path(node)

function retainedBasis(body) {
  const locks = new Set()
  const checks = new Set()
  walk(body, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "for" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "update"
    ) {
      const where = node.expression.expression
      if (
        ts.isCallExpression(where) &&
        ts.isPropertyAccessExpression(where.expression) &&
        where.expression.name.text === "where"
      )
        locks.add(where.arguments.map(value).join(","))
    }
    if (ts.isIfStatement(node) && refusal(node.thenStatement))
      walk(node.expression, (condition) => {
        if (
          ts.isBinaryExpression(condition) &&
          condition.operatorToken.kind ===
            ts.SyntaxKind.ExclamationEqualsEqualsToken
        )
          checks.add(`${value(condition.left)}!=${value(condition.right)}`)
      })
  })
  return (
    locks.has("eq(paperPackageVersions.revision,seal.basis.revision)") &&
    locks.has("eq(files.id,seal.basis.fileId)") &&
    checks.has("packageDigest(version)!=packageDigest(basis.version)") &&
    checks.has("archiveDigest(artifact.bytes)!=seal.basis.packageHash")
  )
}

function refusal(node) {
  return (
    ts.isReturnStatement(node) &&
    node.expression &&
    ts.isCallExpression(node.expression) &&
    ["packageFailure", "unavailable"].includes(path(node.expression.expression))
  )
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const add = (node, kind) =>
    problems.push({
      kind,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    })
  walk(source, (node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return
    const name = node.name.text
    if (["prepareStoredWordPackage", "retained"].includes(name)) {
      const first = node.body.statements[0]
      const negated = name === "retained"
      const condition = first && ts.isIfStatement(first) && first.expression
      const call =
        condition && negated
          ? ts.isPrefixUnaryExpression(condition) &&
            condition.operator === ts.SyntaxKind.ExclamationToken &&
            condition.operand
          : condition
      if (
        !call ||
        !ts.isCallExpression(call) ||
        path(call.expression) !== "insideTransaction" ||
        call.arguments.length !== 0 ||
        !refusal(first.thenStatement)
      )
        add(node, "candidate-transaction-boundary")
    }
    if (name === "prepareStoredWordPackage") {
      let verified = false
      walk(node.body, (child) => {
        if (
          ts.isCallExpression(child) &&
          path(child.expression) === "transaction" &&
          child.arguments.some(
            (argument) =>
              ts.isArrowFunction(argument) && retainedBasis(argument.body)
          )
        )
          verified = true
      })
      if (!verified) add(node, "candidate-retention-recheck")
    }
    if (name !== "publish") return
    const expected = new Set([
      "paperPackageHeads.userId=seal.owner",
      "paperPackageHeads.docId=seal.docId",
      "paperPackageHeads.incarnation=seal.incarnation",
      "paperPackageHeads.revision=identity.parentRevision",
    ])
    let guarded = false
    let checked = false
    walk(node.body, (child) => {
      if (
        ts.isCallExpression(child) &&
        ts.isPropertyAccessExpression(child.expression) &&
        child.expression.name.text === "where"
      ) {
        const [predicate] = child.arguments
        if (
          !predicate ||
          !ts.isCallExpression(predicate) ||
          path(predicate.expression) !== "and"
        )
          return
        const actual = predicate.arguments.map((argument) =>
          ts.isCallExpression(argument) &&
          path(argument.expression) === "eq" &&
          argument.arguments.length === 2
            ? argument.arguments.map(path).join("=")
            : ""
        )
        guarded =
          actual.length === expected.size &&
          actual.every((item) => expected.has(item))
      }
      if (
        ts.isIfStatement(child) &&
        ts.isBinaryExpression(child.expression) &&
        path(child.expression.left) === "changed.length" &&
        child.expression.operatorToken.kind ===
          ts.SyntaxKind.ExclamationEqualsEqualsToken &&
        ts.isNumericLiteral(child.expression.right) &&
        child.expression.right.text === "1" &&
        refusal(child.thenStatement)
      )
        checked = true
    })
    if (!guarded || !checked) add(node, "candidate-exact-head-cas")
  })
  return problems
}
