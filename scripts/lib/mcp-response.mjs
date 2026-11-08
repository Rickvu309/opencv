import ts from "typescript"

function boundary(text) {
  const source = ts.createSourceFile(
    "http.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  let result
  function visit(node) {
    if (ts.isVariableStatement(node) && ts.isBlock(node.parent)) {
      const handler = node.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "handler" &&
          declaration.initializer &&
          ts.isCallExpression(declaration.initializer) &&
          ts.isIdentifier(declaration.initializer.expression) &&
          declaration.initializer.expression.text === "createMcpHandler"
      )
      if (handler)
        result = { source, start: node.end, end: node.parent.end - 1 }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!result) throw new Error("Missing MCP response boundary")
  return result
}

export function detect(text) {
  const { source, start, end } = boundary(text)
  const hits = []
  function visit(node) {
    if (
      node.getStart(source) >= start &&
      node.end <= end &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["arrayBuffer", "text", "json", "blob", "formData"].includes(
        node.expression.name.text
      )
    )
      hits.push({
        line:
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        kind: "buffered-mcp-response",
      })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

export function responseAdapter(text) {
  const { start, end } = boundary(text)
  const { outputText } = ts.transpileModule(text.slice(start, end), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  })
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  return new AsyncFunction(
    "handler",
    "c",
    "insideTransaction",
    "CommandError",
    "ERROR_CODES",
    outputText
  )
}
