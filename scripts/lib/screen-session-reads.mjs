import ts from "typescript"

export const SESSION_ASKERS = new Set([
  "apps/web/src/lib/session-check.ts",
  "apps/web/src/router.tsx",
])

function asksServer(call) {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text === "checkSession"
  if (ts.isPropertyAccessExpression(callee))
    return ["checkSession", "getSession"].includes(callee.name.text)
  return false
}

export function detect(source, file = "screen.tsx") {
  if (SESSION_ASKERS.has(file)) return []
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const problems = []
  const visit = (node) => {
    if (ts.isCallExpression(node) && asksServer(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      problems.push(
        `${file}:${line + 1}: ${node.expression.getText()}() asks the server for the session again; use loadedSessionCheck() so the screen reuses the session the auth client loaded`
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return problems
}
