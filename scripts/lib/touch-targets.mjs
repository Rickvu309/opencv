import ts from "typescript"

const UNITS = 4
const MIN_PX = 44
const SIZE_UTILITY =
  /^(?:h|size|min-h)-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])$/
const WIDTH_UTILITY = /^w-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])$/
const WIDTH_FLOOR = /^(?:w|min-w)-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])$/
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

function widthPixels(token, pattern) {
  const match = pattern.exec(token)
  if (!match) return null
  return match[1] ? Number(match[1]) * UNITS : Number(match[2])
}

export function smallPhoneWidths(classText) {
  return classText
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const px = widthPixels(token, WIDTH_UTILITY)
      return px !== null && px < MIN_PX
    })
}

export function hasPhoneWidth(classText) {
  return classText
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => {
      const px = widthPixels(token, WIDTH_FLOOR)
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
const KIT_TOUCH_SIZES = { "md:h-8": "touch", "md:h-9": "touch-lg" }
const SIZES_WITH_TOUCH_PADDING = new Set(["default", "lg"])

function attributeOf(opening, name) {
  return opening.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === name
  )
}

function sizeOf(opening) {
  const size = attributeOf(opening, "size")
  if (!size) return { value: "default", node: null }
  if (size.initializer && ts.isStringLiteral(size.initializer))
    return { value: size.initializer.text, node: size }
  return { value: null, node: size }
}

function desktopPairOf(text) {
  const tokens = new Set(text.split(/\s+/))
  if (!tokens.has("h-11")) return null
  return Object.keys(KIT_TOUCH_SIZES).find((token) => tokens.has(token)) ?? null
}

function jsxOpenings(file) {
  const out = []
  const visit = (node) => {
    const opening = ts.isJsxSelfClosingElement(node)
      ? node
      : ts.isJsxElement(node)
        ? node.openingElement
        : null
    if (opening && BUTTON_TAGS.has(opening.tagName.getText(file)))
      out.push(opening)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return out
}

function parse(source, fileName) {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
}

export function handTouchPairs(source, fileName = "file.tsx") {
  const file = parse(source, fileName)
  const found = []
  for (const opening of jsxOpenings(file)) {
    const className = attributeOf(opening, "className")
    if (!className) continue
    const literals = stringsIn(className)
    const desktop = desktopPairOf(literals.map((entry) => entry.text).join(" "))
    if (!desktop) continue
    const size = sizeOf(opening)
    const literal = literals.find(
      (entry) => desktopPairOf(entry.text) === desktop
    )
    found.push({
      line: file.getLineAndCharacterOfPosition(opening.getStart(file)).line + 1,
      desktop,
      kitSize: KIT_TOUCH_SIZES[desktop],
      size: size.value,
      sizeNode: size.node,
      literal: literal?.node ?? null,
      classAttribute: className,
      movable:
        SIZES_WITH_TOUCH_PADDING.has(size.value) &&
        literal !== undefined &&
        ts.isStringLiteral(literal.node),
      why: `a Button hand-writes h-11 ${desktop}; use the kit size instead (\`size="${KIT_TOUCH_SIZES[desktop]}"\`)`,
    })
  }
  return found
}

const KIT_PHONE_SIZES = new Set(Object.values(KIT_TOUCH_SIZES))

export function smallTargets(source, fileName = "file.tsx") {
  const file = parse(source, fileName)
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
      const kitPhoneSize = KIT_PHONE_SIZES.has(sizeOf(opening).value)
      if (!kitPhoneSize && !hasPhoneTarget(text))
        found.push({
          line: lineOf(opening),
          why: 'a Button needs a phone height: `size="touch"` for a text button, or `size-11 md:size-7` for an icon',
        })
      const narrow = smallPhoneWidths(text)
      if (narrow.length > 0 && !hasPhoneWidth(text))
        found.push({
          line: lineOf(opening),
          why: `a Button sets ${narrow.join(" ")} on a phone (use \`w-11 md:w-7\`)`,
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
