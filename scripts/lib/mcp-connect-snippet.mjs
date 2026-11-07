import ts from "typescript"

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function staticText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
  if (!ts.isTemplateExpression(node)) return null
  return (
    node.head.text +
    node.templateSpans.map((span) => span.literal.text).join("")
  )
}

function propertyName(name) {
  if (!name) return null
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  )
    return name.text
  return null
}

function snippetLike(text) {
  return /claude mcp add|mcpServers|mcp_servers|existing remote server/.test(
    text
  )
}

function badUrls(text) {
  const found = text.match(/https?:\/\/[^\s"'`]+/g) ?? []
  return found.filter((raw) => {
    try {
      const path = new URL(raw).pathname.replace(/\/+$/, "") || "/"
      return path !== "/mcp"
    } catch {
      return false
    }
  })
}

export function detect(text) {
  const source = ts.createSourceFile(
    "snippets.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const forcesMcp = /pathname\s*=\s*["']\/mcp["']/.test(text)
  const hits = []
  const flagUrl = (node) => {
    const line = lineOf(source, node)
    const body = staticText(node)
    if (body !== null) {
      if (badUrls(body).length > 0) hits.push({ kind: "url", line })
      else if (ts.isTemplateExpression(node) && !forcesMcp)
        hits.push({ kind: "url", line })
      return
    }
    if (!forcesMcp) hits.push({ kind: "url", line })
  }
  const collectConfigUrls = (node) => {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === "url")
      flagUrl(node.initializer)
    if (
      ts.isShorthandPropertyAssignment(node) &&
      propertyName(node.name) === "url"
    )
      flagUrl(node.name)
    ts.forEachChild(node, collectConfigUrls)
  }
  const visit = (node) => {
    const body = staticText(node)
    if (body && snippetLike(body)) {
      const line = lineOf(source, node)
      if (/--transport\s+sse\b/.test(body)) hits.push({ kind: "sse", line })
      if (badUrls(body).length > 0) hits.push({ kind: "url", line })
      const interpolated = ts.isTemplateExpression(node)
      if (interpolated && !forcesMcp && badUrls(body).length === 0)
        hits.push({ kind: "url", line })
    }
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "mcpServers"
    )
      collectConfigUrls(node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
