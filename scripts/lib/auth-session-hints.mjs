import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function functionName(node) {
  return ts.isFunctionDeclaration(node) ? node.name?.text : undefined
}

function isShellEmailEffect(node) {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false
  const call = node.parent
  if (
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== "useEffect" ||
    call.arguments[0] !== node
  )
    return false
  let owner = call.parent
  while (owner && !ts.isFunctionLike(owner)) owner = owner.parent
  if (!owner || functionName(owner) !== "ShellOverlays") return false
  let hasEmailHint = false
  walk(node.body, (child) => {
    if (ts.isIdentifier(child) && child.text === "SIGNED_OUT_EMAIL_KEY")
      hasEmailHint = true
  })
  return hasEmailHint
}

function hintOwner(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ["readLanguage", "readSignedOutEmail"].includes(functionName(parent)) ||
      isShellEmailEffect(parent)
    )
      return true
  }
  return false
}

function isStorageAccess(node) {
  if (ts.isIdentifier(node) && node.text === "sessionStorage")
    return !(
      ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
    )
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "sessionStorage" &&
    ts.isIdentifier(node.expression)
  )
    return ["window", "globalThis"].includes(node.expression.text)
  return (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    ["window", "globalThis"].includes(node.expression.text) &&
    ts.isStringLiteral(node.argumentExpression) &&
    node.argumentExpression.text === "sessionStorage"
  )
}

function caughtInSameFunction(node) {
  for (let child = node; child.parent; child = child.parent) {
    const parent = child.parent
    if (ts.isFunctionLike(parent)) return false
    if (
      ts.isTryStatement(parent) &&
      parent.tryBlock === child &&
      parent.catchClause
    )
      return true
  }
  return false
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  walk(source, (node) => {
    if (isStorageAccess(node) && hintOwner(node) && !caughtInSameFunction(node))
      problems.push({
        kind: "unprotected-session-hint",
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
  })
  return problems
}
