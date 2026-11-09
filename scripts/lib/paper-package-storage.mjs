import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
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
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "uniqueIndex" &&
      node.arguments.some(
        (arg) =>
          ts.isStringLiteral(arg) && arg.text === "paper_package_identity_idx"
      )
    )
      add(node, "late-package-identity-constraint")
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "update" &&
      node.arguments.some(
        (arg) => arg.getText(source) === "paperPackageVersions"
      ) &&
      !file.endsWith(".test.ts")
    )
      add(node, "mutable-package-version")
    if (
      ts.isImportDeclaration(node) &&
      file.endsWith("package-http.ts") &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(
        (item) => item.name.text === "publishWordPackage"
      )
    )
      add(node, "public-head-executor")
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return
    const name = node.name.text
    const calls = []
    walk(node.body, (child) => {
      if (ts.isCallExpression(child))
        calls.push({ name: child.expression.getText(source), node: child })
    })
    const has = (value) => calls.some((call) => call.name === value)
    const insertsHead = calls.find(
      (call) =>
        call.name.endsWith(".insert") &&
        call.node.arguments.some(
          (arg) => arg.getText(source) === "paperPackageHeads"
        )
    )
    if (
      name === "publishWordPackage" &&
      (!has("transaction") ||
        !has("completeVersion") ||
        !insertsHead ||
        calls.find((call) => call.name === "completeVersion")?.node.pos >
          insertsHead.node.pos)
    )
      add(node, "unfinished-package-head")
    if (
      name === "stageWordPackage" &&
      (!has("PaperPackage.open") || !has("transaction") || insertsHead)
    )
      add(node, "flattened-or-published-stage")
    if (
      ["readWordPackage", "exportWordPackage"].includes(name) &&
      (!has("ownedVersion") ||
        !has("completeVersion") ||
        has("PaperPackage.open"))
    )
      add(node, "mutable-read-projection")
    if (
      ["stageWordPackage", "readWordPackage", "exportWordPackage"].includes(
        name
      ) &&
      calls.some((call) =>
        [
          "parseImportFile",
          "mammoth.extractRawText",
          "mammoth.convertToHtml",
        ].includes(call.name)
      )
    )
      add(node, "flattened-package")
  })
  return problems
}
