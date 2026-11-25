import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

const path = (node) =>
  !node
    ? ""
    : ts.isIdentifier(node)
      ? node.text
      : ts.isPropertyAccessExpression(node)
        ? `${path(node.expression)}.${node.name.text}`
        : ""

const call = (node, name) =>
  ts.isCallExpression(node) && path(node.expression) === name

function nodes(root, predicate) {
  const found = []
  if (root)
    walk(root, (node) => {
      if (predicate(node)) found.push(node)
    })
  return found
}

function declarations(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const functions = new Map()
  walk(tree, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name)
      functions.set(node.name.text, node)
  })
  return { tree, functions }
}

function findings(tree) {
  const problems = []
  return {
    problems,
    require(ok, kind, node) {
      if (!ok)
        problems.push({
          kind,
          line:
            tree.getLineAndCharacterOfPosition(node?.getStart(tree) ?? 0).line +
            1,
        })
    },
  }
}

function rollbackChecks(tree, functions, check) {
  const hydrate = functions.get("hydrate")
  if (!hydrate) return
  const detached = functions.get("detached")
  const returns = nodes(detached, (node) => ts.isReturnStatement(node))
  const copy = returns.length === 1 ? returns[0].expression : undefined
  check.require(
    copy &&
      ts.isObjectLiteralExpression(copy) &&
      copy.properties.length === 2 &&
      ts.isSpreadAssignment(copy.properties[0]) &&
      path(copy.properties[0].expression) === "entry" &&
      ts.isPropertyAssignment(copy.properties[1]) &&
      path(copy.properties[1].name) === "yDoc" &&
      call(copy.properties[1].initializer, "forkOf") &&
      path(copy.properties[1].initializer.arguments[0]) === "entry.yDoc",
    "paper-live-detached-fork",
    detached
  )
  const catchups = nodes(hydrate, (node) => call(node, "caughtUp"))
  check.require(
    catchups.length === 1 &&
      call(catchups[0].arguments[0], "detached") &&
      path(catchups[0].arguments[0].arguments[0]) === "cached",
    "paper-cache-detached-hydration",
    hydrate
  )
  check.require(
    nodes(hydrate, (node) => call(node, "remember")).length === 0,
    "paper-cache-uncommitted-hydration",
    hydrate
  )
  const wrapper = functions.get("withLiveTransaction")
  const awaited = nodes(
    wrapper,
    (node) => ts.isAwaitExpression(node) && call(node.expression, "transaction")
  )
  const publications = nodes(tree, (node) => call(node, "remember"))
  const guarded = nodes(wrapper, (node) => {
    if (!ts.isIfStatement(node)) return false
    const condition = node.expression
    return (
      ts.isBinaryExpression(condition) &&
      condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      path(condition.left) === "committed.head" &&
      ts.isPrefixUnaryExpression(condition.right) &&
      condition.right.operator === ts.SyntaxKind.ExclamationToken &&
      call(condition.right.operand, "insideTransaction") &&
      nodes(node.thenStatement, (item) => call(item, "remember")).length === 1
    )
  })
  check.require(
    awaited.length === 1 &&
      publications.length === 1 &&
      guarded.length === 1 &&
      awaited[0].end <= guarded[0].getStart(tree),
    "paper-cache-after-outer-commit",
    wrapper ?? hydrate
  )
  for (const name of ["withContent", "syncContent"]) {
    const owner = functions.get(name)
    if (!owner) continue
    check.require(
      nodes(owner, (node) => call(node, "withLiveTransaction")).length === 1 &&
        nodes(owner, (node) => call(node, "transaction")).length === 0,
      "paper-live-transaction-boundary",
      owner
    )
  }
}

export function detectRollback(source, file = "content-store.ts") {
  const { tree, functions } = declarations(source, file)
  const check = findings(tree)
  rollbackChecks(tree, functions, check)
  return check.problems
}

function importedCalls(tree, module, name) {
  const names = new Set()
  for (const statement of tree.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== module ||
      statement.importClause?.isTypeOnly
    )
      continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements)
        if (!item.isTypeOnly && (item.propertyName ?? item.name).text === name)
          names.add(item.name.text)
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      names.add(`${bindings.name.text}.${name}`)
    }
  }
  return names
}

export function detect(source, file = "content-store.ts") {
  const { tree, functions } = declarations(source, file)
  const check = findings(tree)
  rollbackChecks(tree, functions, check)
  const owner = functions.get("withContent")
  if (!owner) return check.problems
  const attempts = nodes(
    owner,
    (node) =>
      ts.isPropertyAssignment(node) &&
      ["edit", "append"].includes(path(node.name))
  )
  for (const name of ["edit", "append"]) {
    const attempt = attempts.find((node) => path(node.name) === name)
    const operation = `${name}Locked`
    const forks = nodes(
      attempt,
      (node) =>
        ts.isVariableDeclaration(node) &&
        path(node.name) === "candidate" &&
        node.initializer &&
        call(node.initializer, "detached") &&
        path(node.initializer.arguments[0]) === "entry"
    )
    const writes = nodes(attempt, (node) => call(node, operation))
    const awaited =
      writes.length === 1 && ts.isAwaitExpression(writes[0].parent)
    const promotions = nodes(
      attempt,
      (node) =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        path(node.left) === "entry" &&
        path(node.right) === "candidate"
    )
    const accepted = nodes(
      attempt,
      (node) =>
        ts.isIfStatement(node) &&
        path(node.expression) === "next.row" &&
        promotions.length === 1 &&
        node.thenStatement.pos <= promotions[0].pos &&
        promotions[0].end <= node.thenStatement.end
    )
    const rows = nodes(
      attempt,
      (node) =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        path(node.left) === "latest" &&
        path(node.right) === (name === "edit" ? "next" : "next.row")
    )
    check.require(
      forks.length === 1 &&
        writes.length === 1 &&
        path(writes[0].arguments[1]) === "candidate" &&
        awaited &&
        forks[0].end <= writes[0].getStart(tree) &&
        promotions.length === 1 &&
        writes[0].end <= promotions[0].getStart(tree) &&
        rows.length === 1 &&
        writes[0].end <= rows[0].getStart(tree) &&
        (name === "edit" || accepted.length === 1),
      `paper-${name}-attempt-isolation`,
      attempt ?? owner
    )
  }
  return check.problems
}
