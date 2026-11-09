import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function hasCall(node, name) {
  let found = false
  walk(node, (child) => {
    if (ts.isCallExpression(child) && child.expression.getText() === name)
      found = true
  })
  return found
}

function objectRoot(node) {
  while (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    if (
      node.expression.name.text === "object" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "z"
    )
      return true
    node = node.expression.expression
  }
  return false
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
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(source) === "name" &&
          ts.isStringLiteral(property.initializer) &&
          property.initializer.text === "paper.import"
      )
    ) {
      const input = node.properties.find(
        (property) =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(source) === "input"
      )
      if (!input || !objectRoot(input.initializer))
        add(node, "nonobject-import-tool-input")
    }
    if (ts.isBlock(node)) {
      const imported = node.statements.findIndex(
        (statement) =>
          ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) =>
              declaration.initializer &&
              ts.isAwaitExpression(declaration.initializer) &&
              ts.isCallExpression(declaration.initializer.expression) &&
              declaration.initializer.expression.expression.getText(source) ===
                "withImportSignal"
          )
      )
      const read = node.statements.findIndex(
        (statement, index) =>
          index > imported && hasCall(statement, "registry.read")
      )
      if (imported >= 0 && read > imported) {
        const released = node.statements
          .slice(imported + 1, read)
          .some(
            (statement) =>
              ts.isExpressionStatement(statement) &&
              ts.isBinaryExpression(statement.expression) &&
              statement.expression.operatorToken.kind ===
                ts.SyntaxKind.EqualsToken &&
              statement.expression.left.getText(source) === "savedId" &&
              statement.expression.right.getText(source) === "undefined"
          )
        if (!released)
          add(node.statements[imported], "committed-import-cleanup")
      }
    }
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === "section" &&
      node.openingElement.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(source) === "aria-label" &&
          attribute.initializer &&
          ts.isStringLiteral(attribute.initializer) &&
          attribute.initializer.text === "Word documents"
      )
    ) {
      let parent = node.parent
      while (parent && !ts.isConditionalExpression(parent))
        parent = parent.parent
      let loadingGated = false
      let unavailableGated = false
      if (parent)
        walk(parent.condition, (condition) => {
          if (
            ts.isPrefixUnaryExpression(condition) &&
            condition.operator === ts.SyntaxKind.ExclamationToken
          ) {
            const operand = condition.operand.getText(source)
            if (operand === "library.query.isLoading") loadingGated = true
            if (operand === "unavailable") unavailableGated = true
          }
        })
      if (!loadingGated || !unavailableGated)
        add(node, "unannounced-word-library")
    }
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
      ["update", "delete"].includes(node.expression.name.text) &&
      node.arguments.some(
        (arg) => arg.getText(source) === "paperPackageVersions"
      ) &&
      !file.endsWith(".test.ts")
    )
      add(node, "mutable-package-version")
    if (
      ts.isImportDeclaration(node) &&
      (file.endsWith("package-http.ts") ||
        file === "http.ts" ||
        file.endsWith("/paper/http.ts")) &&
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
    if (
      name === "prepareWordPackage" &&
      (!has("insideTransaction") ||
        !has("wordPackageBasis") ||
        !has("PaperPackage.open") ||
        has("transaction") ||
        calls.some((call) => /\.(insert|update|delete)$/.test(call.name)))
    )
      add(node, "writing-or-unpinned-package-planner")
    if (
      name === "ownedVersion" &&
      (!has("ownedHead") ||
        !node.body.getText(source).includes("IN (${published})"))
    )
      add(node, "unpublished-package-read")
    if (
      name === "wordPackageBasis" &&
      (!has("ownedVersion") ||
        !has("ownedHead") ||
        !has("completeVersion") ||
        !node.body.getText(source).includes("head.revision !== basedOn"))
    )
      add(node, "unpinned-package-basis")
    if (
      ["sameRequest", "publishWordPackage"].includes(name) &&
      !node.body.getText(source).includes("version.parentRevision !== null")
    )
      add(node, "child-import-publisher")
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
