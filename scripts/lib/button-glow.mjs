import ts from "typescript"

const GLOW_TOKEN = /(?:^|[\s:"'`])glow(?=$|[\s"'`])/
const RADIAL = /radial-gradient/
const GLOW_SHADOW = /shadow-\[[^\]]*(?:--ring|--chart-\d|--primary)[^\]]*\]/
const BUTTON_TAGS = new Set(["Button", "button", "a", "ButtonPrimitive"])

function glowIn(text) {
  const found = []
  if (GLOW_TOKEN.test(text)) found.push("the glow style")
  if (RADIAL.test(text)) found.push("a radial gradient")
  if (GLOW_SHADOW.test(text)) found.push("a coloured glow shadow")
  return found
}

function stringsIn(node) {
  const out = []
  const visit = (child) => {
    if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child))
      out.push(child.text)
    else if (ts.isTemplateExpression(child))
      out.push(
        [
          child.head.text,
          ...child.templateSpans.map((span) => span.literal.text),
        ].join(" ")
      )
    else if (ts.isIdentifier(child)) out.push({ identifier: child.text })
    ts.forEachChild(child, visit)
  }
  visit(node)
  return out
}

function constantStrings(file) {
  const constants = new Map()
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      constants.set(
        node.name.text,
        stringsIn(node.initializer).filter((piece) => typeof piece === "string")
      )
    ts.forEachChild(node, visit)
  }
  visit(file)
  return constants
}

function cssGlow(source, fileName) {
  const found = []
  if (/@utility\s+glow\b/.test(source))
    found.push(`${fileName}: defines the glow utility`)
  if (RADIAL.test(source))
    found.push(`${fileName}: kit styles draw a radial gradient`)
  return found
}

export function glowButtons(source, fileName = "file.tsx") {
  if (fileName.endsWith(".css")) return cssGlow(source, fileName)
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const constants = constantStrings(file)
  const problems = []
  const report = (node, where, texts) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1
    for (const text of texts)
      for (const kind of glowIn(text))
        problems.push(`${fileName}:${line}: ${where} uses ${kind}`)
  }
  const resolve = (pieces) =>
    pieces.flatMap((piece) =>
      typeof piece === "string"
        ? [piece]
        : (constants.get(piece.identifier) ?? [])
    )
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(file)
      if (BUTTON_TAGS.has(tag))
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue
          const name = attribute.name.getText(file)
          const texts = resolve(stringsIn(attribute.initializer))
          if (name === "variant")
            report(
              node,
              `a ${tag} variant`,
              texts.filter((text) => text === "glow")
            )
          else if (name === "className") report(node, `a ${tag} class`, texts)
        }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "cva" &&
      /button/i.test(fileName)
    )
      report(node, "a button variant", resolve(stringsIn(node)))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...new Set(problems)]
}
