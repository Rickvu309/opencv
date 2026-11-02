import ts from "typescript"

const SPAWNERS = new Set(["spawnSync", "execFileSync", "execSync"])
const QUICK_TOOLS = new Set(["git", "gh", "mkfifo"])

const calleeName = (callee) => {
  if (ts.isIdentifier(callee)) return callee.text
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text
  return null
}

export function detectUnboundedSpawn(text, path = "file.mjs") {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      SPAWNERS.has(calleeName(node.expression))
    ) {
      const [command] = node.arguments
      const quick =
        command &&
        ts.isStringLiteralLike(command) &&
        QUICK_TOOLS.has(command.text)
      if (!quick && !/\btimeout\b/.test(node.getText(source)))
        hits.push({
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          command: command?.getText(source) ?? "",
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
