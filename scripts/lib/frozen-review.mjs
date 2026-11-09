import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  walk(source, (node) => {
    if (!ts.isFunctionLike(node) || !node.body || !node.name) return
    const name = node.name.getText(source)
    const calls = []
    const members = new Set()
    walk(node.body, (child) => {
      if (ts.isCallExpression(child))
        calls.push(child.expression.getText(source))
      if (ts.isPropertyAccessExpression(child)) members.add(child.name.text)
    })
    const needs =
      name === "prepareReview"
        ? ["requirePreparationBoundary", "binding.prepare", "binding.parse"]
        : name === "readFrozenReview"
          ? [
              "envelopeSchema.safeParse",
              "inputHash",
              "binding.parse",
              "refuseFrozenReview",
            ]
          : name === "approve"
            ? ["readFrozenReview", "consumeFrozenReservation", "lockProposal"]
            : name === "prepareTask"
              ? [
                  "requirePreparationBoundary",
                  "requirePublicationBoundary",
                  "checkPreparationTask",
                  "reviewSnapshot",
                  "this.replayByKey",
                  "executeTaskCommand",
                ]
              : name === "runIntent"
                ? [
                    "prepareIntent",
                    "withOwnedTaskFence",
                    "storedIntent",
                    "taskActor",
                    "prepared.publish",
                  ]
                : name === "replayFrozenProposal"
                  ? ["readFrozenReview", "refuseFrozenReview"]
                  : []
    const preparesBeforeFence = node.body.statements?.some(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            declaration.initializer &&
            ts.isAwaitExpression(declaration.initializer) &&
            ts.isCallExpression(declaration.initializer.expression) &&
            declaration.initializer.expression.expression.getText(source) ===
              "prepareIntent"
        )
    )
    if (
      needs.some((call) => !calls.includes(call)) ||
      (name === "approve" &&
        calls.some(
          (call) => call.endsWith(".prepare") || call === "prepareReview"
        )) ||
      (name === "readFrozenReview" && !members.has("bindingVersion")) ||
      (name === "replayFrozenProposal" && !members.has("createdAt")) ||
      (name === "runIntent" && !preparesBeforeFence)
    )
      problems.push({
        kind: "unfrozen-review",
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
  })
  return problems
}

export function kernelSource(text) {
  const source = ts.createSourceFile(
    "frozen-review.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const statements = source.statements.filter(
    (node) => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)
  )
  const selected = ts.factory.updateSourceFile(source, statements)
  return ts.transpileModule(ts.createPrinter().printFile(selected), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText
}

export function approvalSource(text) {
  const source = ts.createSourceFile(
    "registry.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  let selected
  walk(source, (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === "approve")
      selected = node
  })
  if (!selected?.body) throw new Error("Approval method missing")
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
  const code = `const approval = async function (${selected.parameters.map((parameter) => parameter.getText(source)).join(",")}) ${body}`
  return (
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText + "\nreturn approval"
  )
}
