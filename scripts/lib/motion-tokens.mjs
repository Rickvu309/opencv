import ts from "typescript"

export const SCANNED_ROOTS = ["apps/web/src", "packages/ui/src"]

export const TOKEN_FILE = "packages/ui/src/styles/globals.css"

const TOKEN_DEFINITION = /^--(?:duration|ease)-[a-z]+$/

export const LAYOUT_MOTION_ALLOWED = Object.freeze({
  "packages/ui/src/styles/globals.css": ["height"],
  "packages/ui/src/components/sonner.tsx": ["bottom", "right", "height"],
  "packages/ui/src/components/segmented-control-styles.ts": ["left", "right"],
})

const LAYOUT_PROPERTY =
  /^(?:width|height|(?:min|max)-(?:width|height|inline-size|block-size)|inline-size|block-size|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*|top|right|bottom|left|inset(?:-[a-z]+)*|font-size|line-height|letter-spacing|grid-template-(?:columns|rows)|flex-basis)$/

const MOTION_PROPERTY =
  /^(?:transition(?:-duration|-delay|-timing-function|-property)?|animation(?:-duration|-delay|-timing-function)?)$/

const STYLE_KEYS = new Map(
  [
    "transition",
    "transitionDuration",
    "transitionDelay",
    "transitionTimingFunction",
    "transitionProperty",
    "animation",
    "animationDuration",
    "animationDelay",
    "animationTimingFunction",
  ].map((key) => [key, key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)])
)

const LITERAL_TIME = /(?<![\w.-])(\d*\.?\d+)(ms|s)(?![\w-])/g
const ZERO_TIME = new Set(["0", "0.0", ".0", "0.01"])
const CURVE_KEYWORD =
  /(?<![\w-])(?:ease(?:-in-out|-in|-out)?|linear|step-start|step-end)(?![\w-])|(?<![\w-])(?:cubic-bezier|steps|linear)\(/
const LOOP =
  /(?<![\w-])infinite(?![\w-])|(?<![\w-])animate-(?:spin|pulse|ping)(?![\w-])/

const REASON = {
  time: "uses a literal duration or delay; use var(--duration-micro) or var(--duration-panel)",
  curve:
    "uses a plain curve keyword or a hand-written curve; use var(--ease-micro) or var(--ease-panel)",
  all: "transitions every property; name the properties, or use a motion-* utility",
  keyframes:
    "uses tw-animate enter or exit keyframes, which cannot reverse mid-way; use a motion-* utility",
  variable:
    "keeps a motion value in its own CSS variable; read --duration-* and --ease-* directly",
  built: "builds a duration from a number; read motionToken() instead",
}

const layoutReason = (props) =>
  `animates the layout ${props.length > 1 ? "properties" : "property"} ${props.join(", ")}; animate transform or opacity`

function hasLiteralTime(value) {
  for (const match of value.matchAll(LITERAL_TIME))
    if (!ZERO_TIME.has(match[1])) return true
  return false
}

function splitList(value) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === "," && depth === 0) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts.map((part) => part.trim()).filter(Boolean)
}

function transitionedProperties(property, value) {
  if (property === "transition-property")
    return splitList(value).map((part) => part.toLowerCase())
  if (property === "transition")
    return splitList(value).map((part) => part.split(/\s+/)[0].toLowerCase())
  return []
}

function layoutIn(properties, file) {
  const allowed = new Set(LAYOUT_MOTION_ALLOWED[file] ?? [])
  return properties.filter(
    (name) => LAYOUT_PROPERTY.test(name) && !allowed.has(name)
  )
}

export function declarationReasons(property, rawValue, file) {
  const value = rawValue.replace(/!important/g, "").trim()
  if (property.startsWith("--")) {
    if (file === TOKEN_FILE && TOKEN_DEFINITION.test(property)) return []
    if (/^--(?:tw|default)-/.test(property) || LOOP.test(value)) return []
    const bare = value.replace(/^var\([^)]*\)$/, "")
    if (
      /^(?:\d*\.?\d+)(?:ms|s)$/.test(bare) &&
      !ZERO_TIME.has(bare.replace(/m?s$/, ""))
    )
      return [REASON.variable]
    if (
      /^(?:ease(?:-in-out|-in|-out)?|linear|cubic-bezier\(.*\)|steps\(.*\))$/.test(
        bare
      )
    )
      return [REASON.variable]
    return []
  }
  if (!MOTION_PROPERTY.test(property)) return []
  const reasons = []
  const loops = LOOP.test(value)
  if (!loops && hasLiteralTime(value)) reasons.push(REASON.time)
  if (!loops && CURVE_KEYWORD.test(value)) reasons.push(REASON.curve)
  const properties = transitionedProperties(property, value)
  if (properties.includes("all")) reasons.push(REASON.all)
  const layout = layoutIn(properties, file)
  if (layout.length) reasons.push(layoutReason(layout))
  return reasons
}

function lineAt(source, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++
  return line
}

function cssDeclarations(source) {
  const out = []
  const pattern = /(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g
  for (const match of source.matchAll(pattern)) {
    const before = source.slice(0, match.index).trimEnd()
    if (before.length > 0 && !/[{;]$/.test(before)) continue
    out.push({
      property: match[1].toLowerCase(),
      value: match[2],
      index: match.index,
    })
  }
  return out
}

function cssProblems(source, file, offsetLine = 0) {
  const problems = []
  for (const declaration of cssDeclarations(source)) {
    const reasons = declarationReasons(
      declaration.property,
      declaration.value,
      file
    )
    if (reasons.length)
      problems.push({
        line: offsetLine + lineAt(source, declaration.index),
        reasons,
      })
  }
  return problems
}

function stripVariants(token) {
  let depth = 0
  let cut = 0
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === "[" || c === "(") depth++
    else if (c === "]" || c === ")") depth--
    else if (c === ":" && depth === 0) cut = i + 1
  }
  return token.slice(cut).replace(/^!|!$/g, "")
}

function classReasons(text, file) {
  const reasons = new Set()
  const loops = LOOP.test(text)
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const name = stripVariants(raw)
    if (name === "transition-all") reasons.add(REASON.all)
    if (/^animate-(?:in|out)$/.test(name)) reasons.add(REASON.keyframes)
    if (!loops && /^(?:duration|delay)-(?:\d*\.?\d+$|\[)/.test(name)) {
      const amount = name.replace(/^(?:duration|delay)-/, "")
      if (amount !== "0" && amount !== "[0ms]" && amount !== "[0s]")
        reasons.add(REASON.time)
    }
    if (!loops && /^ease-(?:in|out|in-out|linear|\[)/.test(name))
      reasons.add(REASON.curve)
    const listed = name.match(/^transition-\[([^\]]+)\]$/)
    if (listed) {
      const properties = splitList(listed[1].replace(/_/g, " ")).map((part) =>
        part.toLowerCase()
      )
      if (properties.includes("all")) reasons.add(REASON.all)
      const layout = layoutIn(properties, file)
      if (layout.length) reasons.add(layoutReason(layout))
    }
    const arbitrary = name.match(/^\[([a-z-]+|--[\w-]+):(.+)\]$/)
    if (arbitrary)
      for (const reason of declarationReasons(
        arbitrary[1],
        arbitrary[2].replace(/_/g, " "),
        file
      ))
        reasons.add(reason)
  }
  return [...reasons]
}

const CSS_TEXT = /(?:transition|animation)[\w-]*\s*:/

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function templateText(node) {
  return [
    node.head.text,
    ...node.templateSpans.map((span) => span.literal.text),
  ].join(" ")
}

function isAnimateOptions(node) {
  const call = node.parent
  return (
    ts.isCallExpression(call) &&
    call.arguments[1] === node &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === "animate"
  )
}

function scriptProblems(source, file) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const problems = []
  const handled = new Set()
  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  const report = (node, reasons) => {
    if (reasons.length) problems.push({ line: lineOf(node), reasons })
  }
  const styleValue = (key, initializer) => {
    if (
      ts.isStringLiteral(initializer) ||
      ts.isNoSubstitutionTemplateLiteral(initializer)
    ) {
      handled.add(initializer)
      return declarationReasons(key, initializer.text, file)
    }
    if (ts.isTemplateExpression(initializer)) {
      handled.add(initializer)
      const built = initializer.templateSpans.some((span) =>
        /^m?s(?![\w-])/.test(span.literal.text)
      )
      const reasons = declarationReasons(key, templateText(initializer), file)
      return built ? [...new Set([REASON.built, ...reasons])] : reasons
    }
    return []
  }
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name)
      if (name && STYLE_KEYS.has(name))
        report(node, styleValue(STYLE_KEYS.get(name), node.initializer))
      else if (name && name.startsWith("--"))
        report(node, styleValue(name, node.initializer))
    }
    if (ts.isObjectLiteralExpression(node) && isAnimateOptions(node)) {
      const reasons = []
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        const name = propertyName(property.name)
        const value = property.initializer
        if (
          (name === "duration" || name === "delay") &&
          ts.isNumericLiteral(value) &&
          Number(value.text) !== 0
        )
          reasons.push(REASON.time)
        if (name === "easing" && ts.isStringLiteral(value)) {
          handled.add(value)
          reasons.push(REASON.curve)
        }
      }
      report(node, [...new Set(reasons)])
    }
    if (
      !handled.has(node) &&
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node))
    ) {
      const text = ts.isTemplateExpression(node)
        ? templateText(node)
        : node.text
      if (CSS_TEXT.test(text) && /[;{]/.test(text))
        problems.push(...cssProblems(text, file, lineOf(node) - 1))
      else report(node, classReasons(text, file))
      if (ts.isTemplateExpression(node)) return
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      report(node.initializer, classReasons(node.initializer.text, file))
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return problems
}

export function motionTokenProblems(source, file) {
  const problems = /\.css$/.test(file)
    ? cssProblems(source, file)
    : /\.[cm]?[jt]sx?$/.test(file)
      ? scriptProblems(source, file)
      : []
  return problems.map(
    (problem) => `${file}:${problem.line}: ${problem.reasons.join("; ")}`
  )
}

export function scannedFile(file) {
  return (
    SCANNED_ROOTS.some((rootDir) => file.startsWith(`${rootDir}/`)) &&
    /\.(?:css|tsx?)$/.test(file) &&
    !/\.test\.tsx?$/.test(file) &&
    !/\.d\.ts$/.test(file)
  )
}

export function countsByFile(problems) {
  const counts = {}
  for (const problem of problems) {
    const file = problem.slice(0, problem.search(/:\d+: /))
    counts[file] = (counts[file] ?? 0) + 1
  }
  return counts
}
