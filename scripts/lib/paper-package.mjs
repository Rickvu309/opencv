import ts from "typescript"

const call = (node, name) =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === name

const contains = (node, predicate) => {
  if (predicate(node)) return true
  let found = false
  ts.forEachChild(node, (child) => {
    if (contains(child, predicate)) found = true
  })
  return found
}

const string = (node, value) => ts.isStringLiteral(node) && node.text === value

const property = (node, name) =>
  ts.isPropertyAccessExpression(node) && node.name.text === name

const named = (node, name) => contains(node, (item) => property(item, name))

const literal = (node, value) => contains(node, (item) => string(item, value))

const refusal = (node, code) =>
  contains(
    node,
    (item) =>
      ts.isIfStatement(item) &&
      contains(
        item.thenStatement,
        (branch) =>
          call(branch, "locked") &&
          branch.arguments.some((argument) => string(argument, code))
      )
  )

const rules = [
  [
    "tableRevision",
    "Check tracked row and cell property changes",
    (node) =>
      [
        "tcPr",
        "trPr",
        "ins",
        "del",
        "moveFrom",
        "moveTo",
        "cellIns",
        "cellDel",
        "cellMerge",
        "Change",
      ].every((value) => literal(node, value)),
  ],
  [
    "inspectParagraph",
    "Lock tracked table targets before exposing spans",
    (node) => contains(node, (item) => call(item, "tableRevision")),
  ],
  [
    "inspectTargetPolicy",
    "Use indexed paragraph identities and dependency reach",
    (node) =>
      ["paragraphIds", "identityValues", "rangeTargets"].every((name) =>
        named(node, name)
      ) &&
      contains(node, (item) => call(item, "targetDependencies")) &&
      !contains(
        node,
        (item) =>
          call(item, "descendants") &&
          item.arguments.some((argument) => property(argument, "root"))
      ),
  ],
  [
    "targetDependencies",
    "Cache dependency checks per immutable package",
    (node) =>
      ["get", "set"].every((name) =>
        contains(
          node,
          (item) =>
            ts.isCallExpression(item) &&
            property(item.expression, name) &&
            ts.isIdentifier(item.expression.expression) &&
            item.expression.expression.text === "dependencyCache"
        )
      ),
  ],
  [
    "buildTargetDependencies",
    "Index shared style and numbering definitions before target checks",
    (node) =>
      ["style", "num", "abstractNum", "lvl"].every((name) =>
        contains(
          node,
          (item) =>
            call(item, "definitionIndex") &&
            item.arguments.some((argument) => string(argument, name))
        )
      ),
  ],
  [
    "checkRoot",
    "Remember successful and refused shared property checks",
    (node) =>
      ["has", "get", "set"].every((name) => named(node, name)) &&
      contains(node, (item) => ts.isCatchClause(item) && named(item, "set")),
  ],
  [
    "checkStyle",
    "Resolve style chains iteratively and retain both closure outcomes",
    (node) =>
      contains(node, (item) => ts.isWhileStatement(item)) &&
      ["has", "get", "set"].every((name) => named(node, name)) &&
      contains(node, (item) => ts.isCatchClause(item) && named(item, "set")) &&
      !contains(node.body, (item) => call(item, "checkStyle")),
  ],
  [
    "inspectRun",
    "Lock decoded tabs and newlines in Word text",
    (node) =>
      refusal(node, "UNSUPPORTED_TEXT_CONTROL") &&
      contains(
        node,
        (item) =>
          ts.isRegularExpressionLiteral(item) && item.text === "/[\\t\\n\\r]/u"
      ),
  ],
  [
    "directory",
    "Compare OPC member names without case distinctions",
    (node) =>
      ["has", "add"].every((name) =>
        contains(
          node,
          (item) =>
            ts.isCallExpression(item) &&
            property(item.expression, name) &&
            item.arguments.some(
              (argument) =>
                ts.isCallExpression(argument) &&
                property(argument.expression, "toLowerCase")
            )
        )
      ),
  ],
  [
    "open",
    "Parse case-variant XML and relationship parts",
    (node) =>
      contains(
        node,
        (item) =>
          ts.isRegularExpressionLiteral(item) &&
          item.text === "/\\.(xml|rels)$/i"
      ),
  ],
  [
    "relationships",
    "Inspect case-variant relationship parts",
    (node) =>
      contains(
        node,
        (item) =>
          ts.isRegularExpressionLiteral(item) && item.text === "/\\.rels$/i"
      ),
  ],
  [
    "inspectParagraph",
    "Bound full paragraph context before projection",
    (node) =>
      refusal(node, "PARAGRAPH_CONTEXT_TOO_LARGE") &&
      contains(
        node,
        (item) =>
          ts.isBinaryExpression(item) &&
          item.operatorToken.kind === ts.SyntaxKind.GreaterThanToken &&
          named(item.left, "byteLength") &&
          property(item.right, "targetBytes")
      ),
  ],
]

const required = {
  targets: ["paragraphText", "tableRevision", "inspectParagraph", "inspectRun"],
  policy: [
    "inspectTargetPolicy",
    "targetDependencies",
    "buildTargetDependencies",
    "definitionIndex",
    "checkRoot",
    "checkStyle",
  ],
  references: ["relationships"],
  zip: ["directory", "inflate"],
  engine: ["open"],
}

export function detect(source, path = "") {
  const file = ts.createSourceFile(
    "paper-package.ts",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const issues = []
  const functions = new Map()
  const visit = (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.body &&
      node.name
    )
      functions.set(node.name.getText(file), node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  for (const [scope, names] of Object.entries(required))
    if (path.endsWith(`/package-${scope}.ts`))
      for (const name of names)
        if (!functions.has(name))
          issues.push(`Keep the ${name} safety boundary present`)
  for (const [name, message, accepts] of rules) {
    const node = functions.get(name)
    if (node && !accepts(node)) issues.push(message)
  }
  for (const node of file.statements) {
    if (
      ts.isImportDeclaration(node) &&
      string(node.moduleSpecifier, "@xmldom/xmldom")
    )
      issues.push(
        "Keep the XML parser's browser globals outside the API type graph"
      )
    if (!ts.isFunctionDeclaration(node) || !node.body) continue
    if (node.name?.text === "paragraphText") {
      const propertyBarrier = node.body.statements.findIndex(
        (statement) =>
          ts.isIfStatement(statement) &&
          contains(statement.expression, (item) => string(item, "pPr")) &&
          ts.isReturnStatement(statement.thenStatement) &&
          statement.thenStatement.expression &&
          string(statement.thenStatement.expression, "")
      )
      const children = node.body.statements.findIndex(
        (statement) =>
          ts.isReturnStatement(statement) &&
          contains(
            statement,
            (item) =>
              ts.isPropertyAccessExpression(item) &&
              item.name.text === "children"
          )
      )
      if (propertyBarrier < 0 || children < 0 || propertyBarrier >= children)
        issues.push(
          "Skip Word property trees before collecting paragraph content"
        )
      for (const name of ["t", "tab", "br"]) {
        const branch = node.body.statements.find(
          (statement) =>
            ts.isIfStatement(statement) &&
            contains(
              statement.expression,
              (item) =>
                call(item, "isWord") &&
                item.arguments.some((argument) => string(argument, name))
            )
        )
        if (
          !branch ||
          !contains(
            branch.thenStatement,
            (item) =>
              ts.isConditionalExpression(item) &&
              contains(
                item.condition,
                (condition) =>
                  ts.isIdentifier(condition) && condition.text === "inRun"
              )
          )
        )
          issues.push(`Read Word ${name} content only inside a text run`)
      }
    }
    if (node.name?.text === "inflate") {
      if (!contains(node, (item) => call(item, "createInflateRaw")))
        issues.push("Inflate Word members as a bounded stream")
      const handler = []
      const visit = (item) => {
        if (
          ts.isCallExpression(item) &&
          ts.isPropertyAccessExpression(item.expression) &&
          item.expression.name.text === "on" &&
          item.arguments[0] &&
          string(item.arguments[0], "data")
        ) {
          const callback = item.arguments[1]
          if (
            callback &&
            (ts.isArrowFunction(callback) ||
              ts.isFunctionExpression(callback)) &&
            ts.isBlock(callback.body)
          )
            handler.push(callback.body)
        }
        ts.forEachChild(item, visit)
      }
      visit(node)
      if (
        !handler.some((body) => {
          const bound = body.statements.findIndex(
            (statement) =>
              ts.isIfStatement(statement) &&
              contains(
                statement.expression,
                (item) =>
                  ts.isBinaryExpression(item) &&
                  item.operatorToken.kind === ts.SyntaxKind.GreaterThanToken &&
                  ts.isIdentifier(item.left) &&
                  item.left.text === "size" &&
                  ts.isIdentifier(item.right) &&
                  item.right.text === "limit"
              ) &&
              contains(
                statement.thenStatement,
                (item) =>
                  ts.isPropertyAccessExpression(item) &&
                  item.name.text === "destroy"
              ) &&
              contains(statement.thenStatement, ts.isReturnStatement)
          )
          const retain = body.statements.findIndex((statement) =>
            contains(
              statement,
              (item) =>
                ts.isCallExpression(item) &&
                ts.isPropertyAccessExpression(item.expression) &&
                item.expression.name.text === "push"
            )
          )
          return bound >= 0 && retain > bound
        })
      )
        issues.push("Reject expansion before retaining an inflated chunk")
    }
  }
  return issues
}
