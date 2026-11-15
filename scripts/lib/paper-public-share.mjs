import ts from "typescript"

function sourceOf(text) {
  return ts.createSourceFile(
    "paper.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function descendants(node, predicate) {
  const matches = []
  const visit = (child) => {
    if (predicate(child)) matches.push(child)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return matches
}

function namedCall(node, name) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name
  )
}

function methodCall(node, name) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === name
  )
}

function literal(node, value) {
  return !!node && ts.isStringLiteral(node) && node.text === value
}

export function detectSharedOwnerProjection(text) {
  const source = sourceOf(text)
  const hits = []
  const functions = descendants(source, ts.isFunctionDeclaration)
  for (const node of functions) {
    if (node.name?.text === "readShared") {
      if (descendants(node, (child) => namedCall(child, "toPaper")).length)
        hits.push("Shared reads must not reuse the owner document projection")
    }
    if (node.name?.text !== "toSharedPaper") continue
    const projections = descendants(
      node,
      (child) =>
        methodCall(child, "parse") &&
        ts.isIdentifier(child.expression.expression) &&
        child.expression.expression.text === "paperSharedViewSchema"
    )
    const object = projections[0]?.arguments[0]
    const fields =
      object && ts.isObjectLiteralExpression(object)
        ? object.properties.map((property) =>
            ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)
              ? property.name.text
              : null
          )
        : []
    const allowed = ["id", "kind", "name", "paper", "templateId"]
    if (
      projections.length !== 1 ||
      JSON.stringify(fields.slice().sort()) !== JSON.stringify(allowed)
    )
      hits.push("Shared documents need an explicit public field allowlist")
    const paper =
      object && ts.isObjectLiteralExpression(object)
        ? object.properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === "paper"
          )
        : undefined
    const content =
      paper && ts.isPropertyAssignment(paper) ? paper.initializer : undefined
    const last =
      content && ts.isObjectLiteralExpression(content)
        ? content.properties.at(-1)
        : undefined
    if (
      !last ||
      !ts.isPropertyAssignment(last) ||
      !ts.isIdentifier(last.name) ||
      last.name.text !== "clashes" ||
      !ts.isArrayLiteralExpression(last.initializer) ||
      last.initializer.elements.length !== 0
    )
      hits.push("Public documents must exclude private unresolved alternatives")
  }
  return hits
}

export function detectSharedCachePolicy(text) {
  const source = sourceOf(text)
  const hits = []
  const sharedRoutes = descendants(
    source,
    (node) =>
      methodCall(node, "get") &&
      !!node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text.startsWith("/shared/")
  )
  if (sharedRoutes.length === 0) return hits
  const middleware = descendants(
    source,
    (node) => methodCall(node, "use") && literal(node.arguments[0], "/shared/*")
  )
  const uncacheable = middleware.some(
    (node) =>
      descendants(
        node,
        (child) =>
          methodCall(child, "header") &&
          literal(child.arguments[0], "cache-control") &&
          literal(child.arguments[1], "no-store")
      ).length > 0
  )
  if (!uncacheable)
    hits.push("Shared documents and revoked responses must use no-store")
  for (const route of sharedRoutes) {
    const photos = descendants(route, (node) => namedCall(node, "photoBytes"))
    if (photos.some((node) => !literal(node.arguments[1], "no-store")))
      hits.push("Shared photos must not outlive revocation in a response cache")
  }
  return hits
}
