import ts from "typescript"

const UNITS = 4
const MIN_PX = 44
const SIZE_UTILITY =
  /^(?:h|size|min-h)-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])$/
const INTERACTIVE_MARK = /(?:^|\s)(?:hover:|focus-visible:)/

function pixels(token) {
  const match = SIZE_UTILITY.exec(token)
  if (!match) return null
  return match[1] ? Number(match[1]) * UNITS : Number(match[2])
}

export function smallPhoneTokens(classText) {
  return classText
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const px = pixels(token)
      return px !== null && px < MIN_PX
    })
}

export function hasPhoneTarget(classText) {
  return classText
    .split(/\s+/)
    .map((token) => token.replace(/^max-md:/, ""))
    .some((token) => {
      const px = pixels(token)
      return px !== null && px >= MIN_PX
    })
}

function stringsIn(node) {
  const out = []
  const visit = (child) => {
    if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child))
      out.push({ text: child.text, node: child })
    else if (ts.isTemplateExpression(child))
      out.push({
        text: [
          child.head.text,
          ...child.templateSpans.map((span) => span.literal.text),
        ].join(" "),
        node: child,
      })
    ts.forEachChild(child, visit)
  }
  visit(node)
  return out
}

const BUTTON_TAGS = new Set(["Button"])

export function smallTargets(source, fileName = "file.tsx") {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const lineOf = (node) =>
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  const found = []
  const inButtonClass = new Set()
  const visit = (node) => {
    const opening = ts.isJsxSelfClosingElement(node)
      ? node
      : ts.isJsxElement(node)
        ? node.openingElement
        : null
    if (opening && BUTTON_TAGS.has(opening.tagName.getText(file))) {
      const className = opening.attributes.properties.find(
        (attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.text === "className"
      )
      const text = className
        ? stringsIn(className)
            .map((entry) => entry.text)
            .join(" ")
        : ""
      for (const entry of className ? stringsIn(className) : [])
        inButtonClass.add(entry.node)
      if (!hasPhoneTarget(text))
        found.push({
          line: lineOf(opening),
          why: "a Button needs a phone height of h-11 or size-11 (for example `size-11 md:size-7`)",
        })
    }
    if (ts.isStringLiteral(node) || ts.isTemplateExpression(node)) {
      const [entry] = stringsIn(node)
      if (
        entry &&
        !inButtonClass.has(node) &&
        INTERACTIVE_MARK.test(entry.text)
      ) {
        const small = smallPhoneTokens(entry.text)
        if (small.length > 0 && !hasPhoneTarget(entry.text))
          found.push({
            line: lineOf(node),
            why: `an interactive class string sets ${small.join(" ")} with no phone override (use \`h-11 md:h-7\`)`,
          })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
