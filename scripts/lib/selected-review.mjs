import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function named(source, name) {
  let found
  walk(source, (node) => {
    if (
      (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name?.getText(source) === name
    )
      found = node
  })
  return found
}

function body(node, source) {
  return node ? node.getText(source) : ""
}

function block(node, source) {
  return node?.body ? node.body.getText(source) : ""
}

function calls(node, source, name) {
  const found = []
  if (!node) return found
  walk(node, (child) => {
    if (!ts.isCallExpression(child)) return
    const expression = child.expression
    const called = ts.isPropertyAccessExpression(expression)
      ? expression.name.getText(source)
      : expression.getText(source)
    if (called === name) found.push(child)
  })
  return found
}

function problem(kind, node, source) {
  return {
    kind,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  }
}

export function methodSource(text, name) {
  const source = ts.createSourceFile(
    name + ".ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const selected = named(source, name)
  if (!selected?.body) throw new Error(`${name} is missing`)
  const transformed = ts.transform(selected.body, [
    (context) => {
      const visit = (node) =>
        ts.isPrivateIdentifier(node) && node.text === "#execute"
          ? ts.factory.createIdentifier("execute")
          : ts.visitEachChild(node, visit, context)
      return (node) => ts.visitNode(node, visit)
    },
  ])
  const body = ts
    .createPrinter()
    .printNode(ts.EmitHint.Unspecified, transformed.transformed[0], source)
  transformed.dispose()
  const parameters = selected.parameters
    .map((parameter) => parameter.getText(source))
    .join(",")
  const code = `const ${name.replace("#", "")} = async function (${parameters}) ${body}\nreturn ${name.replace("#", "")}`
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const selection = named(source, "taskNeedsPreparation")
  if (
    selection &&
    (!selection.parameters.some(
      (parameter) => parameter.name.getText(source) === "input"
    ) ||
      !body(selection, source).includes("reviewedFor") ||
      !body(selection, source).includes(".select") ||
      !body(selection, source).includes("input"))
  )
    problems.push(problem("name-only-selection", selection, source))
  const prepare = named(source, "prepareIntent")
  if (
    prepare &&
    (!body(prepare, source).includes("taskNeedsPreparation") ||
      !body(prepare, source).includes("stored.input"))
  )
    problems.push(problem("name-only-selection", prepare, source))
  const approve = named(source, "approve")
  if (approve) {
    const called = []
    walk(approve, (child) => {
      if (ts.isCallExpression(child))
        called.push(child.expression.getText(source))
    })
    const sourceText = body(approve, source)
    if (
      called.some(
        (call) => call === "prepareReview" || call.endsWith(".prepare")
      ) ||
      !sourceText.includes("reviewedFor") ||
      !sourceText.includes("readFrozenReview")
    )
      problems.push(problem("approval-time-prepare", approve, source))
    if (!/frozenReview\s*!=\s*null\s*&&\s*!frozen/.test(sourceText))
      problems.push(problem("selected-branch-downgrade", approve, source))
  }
  const execute = named(source, "#execute")
  if (
    execute &&
    (!body(execute, source).includes("frozenExecution") ||
      !body(execute, source).includes("!reviewed") ||
      !body(execute, source).includes("refuseFrozenReview"))
  )
    problems.push(problem("selected-branch-downgrade", execute, source))
  if (execute && body(execute, source).includes("isUnchanged")) {
    const text = body(execute, source)
    if (
      !text.includes("publishUnchanged") ||
      text.includes("basisRowLocks") ||
      text.includes("requireBasisLock") ||
      text.includes("openBasisLock") ||
      text.includes("token.value") ||
      text.includes("pg_locks")
    )
      problems.push(problem("unlocked-basis", execute, source))
  }
  const unchangedPublish = named(source, "publishUnchanged")
  if (unchangedPublish) {
    const text = block(unchangedPublish, source)
    if (
      !text.includes("lockBasis") ||
      text.includes("token.value") ||
      text.includes(".lock(") ||
      text.includes("openBasisLock")
    )
      problems.push(problem("unlocked-basis", unchangedPublish, source))
  }
  const reviewedLock = named(source, "lockReviewedBasis")
  if (
    reviewedLock &&
    (!block(reviewedLock, source).includes("lockBasis") ||
      block(reviewedLock, source).includes("token.value"))
  )
    problems.push(problem("unlocked-basis", reviewedLock, source))
  const frozenPublish = named(source, "publishFrozenReview")
  if (
    frozenPublish &&
    !block(frozenPublish, source).includes("lockReviewedBasis")
  )
    problems.push(problem("unlocked-basis", frozenPublish, source))
  const basisLock = named(source, "lockBasis")
  if (basisLock) {
    const text = block(basisLock, source)
    if (
      !text.includes('.for("update")') ||
      !text.includes("eq(") ||
      text.includes("spec.where") ||
      text.includes("spec.columns") ||
      text.includes("token") ||
      text.includes("keyShare") ||
      text.includes("pg_locks")
    )
      problems.push(problem("unlocked-basis", basisLock, source))
  }
  for (const retired of ["openBasisLock", "requireBasisToken"]) {
    const found = named(source, retired)
    if (found) problems.push(problem("unlocked-basis", found, source))
  }
  const shape = named(source, "isUnchanged")
  if (
    shape &&
    (!block(shape, source).includes('!("candidate" in value)') ||
      !block(shape, source).includes('!("review" in value)'))
  )
    problems.push(problem("unchanged-shape", shape, source))
  if (
    text.includes("prepared.candidate.after") &&
    !text.includes("locked.compared")
  )
    problems.push(problem("plain-mutation", source, source))
  const restore = named(source, "compareAndRestore")
  if (
    restore &&
    (!block(restore, source).includes("user.name") ||
      !block(restore, source).includes("expected"))
  )
    problems.push(problem("unconditional-restore", restore, source))
  const admit = named(source, "admitCommand")
  if (
    admit &&
    (!body(admit, source).includes("undoOnly") ||
      !body(admit, source).includes("FORBIDDEN"))
  )
    problems.push(problem("direct-private-restore", admit, source))
  for (const name of ["list", "commandNames", "tools"]) {
    const exposed = named(source, name)
    if (exposed && !body(exposed, source).includes("undoOnly"))
      problems.push(problem("direct-private-restore", exposed, source))
  }
  const undo = named(source, "undo")
  const flagged = undo ? calls(undo, source, "#execute") : []
  if (
    undo &&
    !flagged.some(
      (call) =>
        call.arguments.length === 2 &&
        call.arguments[1].getText(source) === "true"
    )
  )
    problems.push(problem("direct-private-restore", undo, source))
  const visible = named(source, "execute")
  if (
    visible &&
    calls(visible, source, "#execute").some(
      (call) => call.arguments.length !== 1
    )
  )
    problems.push(problem("direct-private-restore", visible, source))
  walk(source, (node) => {
    if (!ts.isMethodDeclaration(node) || node.name.getText(source) === "undo")
      return
    if (
      calls(node, source, "#execute").some(
        (call) => call.arguments.length === 2
      )
    )
      problems.push(problem("direct-private-restore", node, source))
  })
  return problems
}
