import ts from "typescript"

const children = (node, predicate) => {
  if (predicate(node)) return true
  return ts.forEachChild(node, (child) => children(child, predicate)) === true
}
const member = (node, name) =>
  ts.isPropertyAccessExpression(node) && node.name.text === name
const called = (node, name) =>
  ts.isCallExpression(node) && member(node.expression, name)
const emptySuccess = (node) => {
  if (ts.isIdentifier(node) && node.text === "undefined") return true
  if (ts.isVoidExpression(node)) return true
  return ts.isBlock(node) && node.statements.length === 0
}

export function detect(text) {
  const tree = ts.createSourceFile(
    "paper-print.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const findings = []
  for (const owner of tree.statements) {
    if (
      !ts.isFunctionDeclaration(owner) ||
      !["printPaper", "readyPhoto", "capturePrintReadiness"].includes(
        owner.name?.text
      ) ||
      !owner.body
    )
      continue
    const bindings = new Map()
    const collect = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      )
        bindings.set(node.name.text, node.initializer)
      ts.forEachChild(node, collect)
    }
    collect(owner.body)
    const depends = (node, predicate, seen = new Set()) => {
      if (predicate(node)) return true
      if (
        ts.isIdentifier(node) &&
        bindings.has(node.text) &&
        !seen.has(node.text)
      ) {
        const next = new Set(seen).add(node.text)
        if (depends(bindings.get(node.text), predicate, next)) return true
      }
      return (
        ts.forEachChild(node, (child) =>
          depends(child, predicate, new Set(seen))
        ) === true
      )
    }
    const deadlineResolves = (node) => {
      if (
        !ts.isNewExpression(node) ||
        !ts.isIdentifier(node.expression) ||
        node.expression.text !== "Promise"
      )
        return false
      const callback = node.arguments?.[0]
      if (
        !callback ||
        !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
      )
        return false
      const resolve = callback.parameters[0]?.name
      if (!resolve || !ts.isIdentifier(resolve)) return false
      return children(callback.body, (child) => {
        if (!ts.isCallExpression(child)) return false
        const name = ts.isIdentifier(child.expression)
          ? child.expression.text
          : ts.isPropertyAccessExpression(child.expression)
            ? child.expression.name.text
            : ""
        if (name !== "setTimeout") return false
        const handler = child.arguments[0]
        return Boolean(
          handler &&
          ((ts.isIdentifier(handler) && handler.text === resolve.text) ||
            children(
              handler,
              (n) =>
                ts.isCallExpression(n) &&
                ts.isIdentifier(n.expression) &&
                n.expression.text === resolve.text
            ))
        )
      })
    }
    const swallowedDecode = (node) => {
      if (
        !called(node, "catch") ||
        !children(node.expression.expression, (n) => called(n, "decode"))
      )
        return false
      const handler = node.arguments[0]
      return Boolean(
        handler &&
        (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
        emptySuccess(handler.body)
      )
    }
    const visit = (node) => {
      if (owner.name.text !== "printPaper" && swallowedDecode(node))
        findings.push("A required decode rejection becomes readiness success")
      if (called(node, "then")) {
        const onSuccess = node.arguments[0]
        const prints =
          onSuccess &&
          children(
            onSuccess,
            (n) =>
              ts.isCallExpression(n) &&
              member(n.expression, "print") &&
              ts.isIdentifier(n.expression.expression) &&
              n.expression.expression.text === "window"
          )
        if (
          prints &&
          depends(node.expression.expression, (n) => called(n, "race"))
        ) {
          if (depends(node.expression.expression, deadlineResolves))
            findings.push("A resolving deadline can authorize window.print")
          if (depends(node.expression.expression, swallowedDecode))
            findings.push(
              "A required decode rejection becomes readiness success"
            )
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(owner.body)
  }
  return [...new Set(findings)]
}
