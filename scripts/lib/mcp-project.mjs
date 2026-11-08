import ts from "typescript"

export function detect(text, file = "http.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const hit = (node, kind) =>
    hits.push({
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      kind,
    })
  const calls = []
  let policy
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "delegateAllowed")
      policy = node
    if (ts.isCallExpression(node)) calls.push(node)
    if (
      ts.isArrayLiteralExpression(node) &&
      node.elements.length &&
      node.elements.every(
        (item) =>
          ts.isStringLiteral(item) &&
          !item.text.includes("/") &&
          (item.text.includes(".") || item.text.includes("_"))
      )
    )
      hit(node, "handwritten-tool-list")
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "registerTool" &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      hit(node, "handwritten-tool-registration")
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (file.endsWith("delegate-policy.ts")) {
    if (!policy) return [{ line: 1, kind: "missing-delegate-policy" }]
    try {
      const javascript = ts.transpileModule(
        policy.getText(source).replace("export ", ""),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }
      ).outputText
      const allowed = new Function(`${javascript}; return delegateAllowed`)()
      for (const delegate of [
        undefined,
        "jobRead",
        "reversibleJob",
        "unknown",
      ]) {
        for (const scopes of [
          [],
          ["job.read"],
          ["job.write"],
          ["job.read", "job.write"],
        ]) {
          for (const resources of ["none", "jobs"]) {
            const actor = {
              type: "delegate",
              scopes,
              resources,
              reads: "allow",
              writes: "approval",
            }
            const expected =
              resources === "jobs" &&
              (delegate === "jobRead"
                ? scopes.includes("job.read")
                : delegate === "reversibleJob" && scopes.includes("job.write"))
            if (
              allowed(
                { name: "job.fixture", coach: "auto", delegate },
                actor
              ) !== expected
            )
              throw new Error("scope or declaration mismatch")
          }
        }
      }
    } catch {
      hit(policy, "delegate-without-declared-scope")
    }
  } else if (
    !calls.some(
      (call) =>
        ts.isPropertyAccessExpression(call.expression) &&
        call.expression.expression.getText(source) === "registry" &&
        call.expression.name.text === "tools"
    )
  ) {
    hits.push({ line: 1, kind: "missing-registry-projection" })
  }
  return hits
}
