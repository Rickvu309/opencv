import ts from "typescript"

export function detectUnownedWriting(text) {
  const source = ts.createSourceFile(
    "writing.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let mistake = false
  const access = (node, name) =>
    ts.isPropertyAccessExpression(node) && node.name.text === name
  const conjunctions = (node) =>
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ? [...conjunctions(node.left), ...conjunctions(node.right)]
      : [node]
  const equalAccess = (node, field, expected) =>
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    access(node.left, field) &&
    node.right.getText(source) === expected
  function wordsMatch(node) {
    let found = false
    function inspect(part) {
      if (
        ts.isBinaryExpression(part) &&
        [
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ].includes(part.operatorToken.kind) &&
        (access(part.left, "words") || access(part.right, "words"))
      )
        found = true
      ts.forEachChild(part, inspect)
    }
    inspect(node)
    return found
  }
  function receiptQualified(callback) {
    if (!ts.isArrowFunction(callback) || ts.isBlock(callback.body)) return false
    const parts = conjunctions(callback.body)
    return (
      parts.some(
        (part) =>
          equalAccess(part, "revision", "revision") &&
          access(part.left.expression, "receipt")
      ) &&
      parts.some(
        (part) =>
          equalAccess(part, "docId", "record.docId") &&
          access(part.left.expression, "receipt")
      ) &&
      parts.some(
        (part) =>
          ts.isCallExpression(part) &&
          access(part.expression, "includes") &&
          access(part.expression.expression, "authorized") &&
          part.arguments.length === 1 &&
          access(part.arguments[0], "attemptId")
      )
    )
  }
  function durableNotice(node) {
    if (
      !ts.isCallExpression(node) ||
      node.expression.getText(source) !== "keptOnThisComputer"
    )
      return
    let parent = node.parent
    let qualified = false
    while (parent) {
      if (
        ts.isConditionalExpression(parent) &&
        ["stored.current", "outcome.local"].includes(
          parent.condition.getText(source)
        )
      )
        qualified = true
      if (
        ts.isCallExpression(parent) &&
        parent.expression.getText(source) === "useEffect"
      ) {
        const callback = parent.arguments[0]
        if (callback?.getText(source).includes("settlePage(") && !qualified) {
          const body = callback.body
          const guarded =
            body &&
            ts.isBlock(body) &&
            body.statements.some(
              (statement) =>
                statement.end < node.pos &&
                ts.isIfStatement(statement) &&
                statement.expression.getText(source) === "!stored.current" &&
                ts.isReturnStatement(statement.thenStatement)
            )
          if (!guarded) mistake = true
        }
        return
      }
      parent = parent.parent
    }
  }
  function visit(node) {
    durableNotice(node)
    if (
      ts.isCatchClause(node) &&
      node.block.getText(source).includes("opened = null")
    )
      mistake = true
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === "SentRecord" &&
      ts.isTypeLiteralNode(node.type)
    ) {
      const names = new Set(
        node.type.members.flatMap((member) =>
          member.name && ts.isIdentifier(member.name) ? [member.name.text] : []
        )
      )
      if (
        !["writerId", "attemptId", "input", "idempotencyKey", "receipt"].every(
          (name) => names.has(name)
        )
      )
        mistake = true
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["find", "findLast", "filter"].includes(node.expression.name.text)
    ) {
      const callback = node.arguments[0]
      if (callback && wordsMatch(callback) && !receiptQualified(callback))
        mistake = true
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "get" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "store" &&
      node.arguments.length === 1 &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === "docId"
    )
      mistake = true
    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      ts.isTemplateExpression(node.expression) &&
      node.expression.head.text === "opencv-writing:" &&
      node.expression.templateSpans.length === 1
    )
      mistake = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return mistake
}

export function detectMissingWritingReconnect(text) {
  const source = ts.createSourceFile(
    "canvas.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let connection = null
  let mistake = false
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === "useWritingReconnect"
    )
      connection = node.name.text
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "useEffect"
    ) {
      const callback = node.arguments[0]
      if (callback?.getText(source).includes("settlePage(")) {
        const deps = node.arguments[1]
        if (
          !connection ||
          !deps ||
          !ts.isArrayLiteralExpression(deps) ||
          !deps.elements.some(
            (item) => ts.isIdentifier(item) && item.text === connection
          )
        )
          mistake = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return mistake
}
