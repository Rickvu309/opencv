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

export function detect(source) {
  const file = ts.createSourceFile(
    "paper-package.ts",
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const issues = []
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
