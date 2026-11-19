import ts from "typescript"

export const SCANNED_ROOTS = ["apps/web/src"]

export const scannedFile = (file) =>
  SCANNED_ROOTS.some((root) => file.startsWith(`${root}/`)) &&
  /\.test\.tsx?$/.test(file)

const UTILITY_PREFIXES = [
  "h",
  "w",
  "size",
  "min-h",
  "min-w",
  "max-h",
  "max-w",
  "p",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "ps",
  "pe",
  "m",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "bg",
  "text",
  "font",
  "leading",
  "tracking",
  "rounded",
  "border",
  "ring",
  "shadow",
  "outline",
  "opacity",
  "z",
  "top",
  "left",
  "right",
  "bottom",
  "inset",
  "items",
  "justify",
  "self",
  "place",
  "overflow",
  "shrink",
  "grow",
  "basis",
  "flex",
  "grid",
  "col",
  "row",
  "order",
  "touch",
  "cursor",
  "select",
  "pointer-events",
  "transition",
  "duration",
  "ease",
  "delay",
  "animate",
  "translate",
  "scale",
  "rotate",
  "origin",
  "line-clamp",
  "whitespace",
  "break",
  "decoration",
  "aspect",
  "object",
  "fill",
  "stroke",
  "backdrop",
  "blur",
  "divide",
  "content",
]

const UTILITY_WORDS = [
  "flex",
  "grid",
  "hidden",
  "block",
  "inline",
  "inline-flex",
  "inline-block",
  "contents",
  "truncate",
  "sr-only",
  "not-sr-only",
  "invisible",
  "visible",
  "absolute",
  "relative",
  "fixed",
  "sticky",
  "underline",
  "italic",
  "uppercase",
  "lowercase",
  "tabular-nums",
  "shrink",
  "grow",
  "dark",
]

const escape = (word) => word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")

const PART = String.raw`(?:[a-z0-9]+(?:\.\d+)?(?:\/\d+)?|\[[^\]\s]+\]|\([^)\s]+\))`
const BODY = String.raw`!?(?:[^\s:'"]+:)*!?-?(?:(?:${UTILITY_PREFIXES.map(escape).join("|")})-${PART}(?:-${PART})*|(?:${UTILITY_WORDS.map(escape).join("|")}))!?`
const OPEN_BODY = String.raw`!?(?:[^\s:'"|()]+:)*!?-?(?:${UTILITY_PREFIXES.map(escape).join("|")})-(?:${PART}(?:-${PART})*)?`
const CLASS_TOKEN = new RegExp(`^${BODY}$`)
const CLASS_IN_PATTERN = new RegExp(
  String.raw`(?:^|[\s|()^]|\\[bs])(${OPEN_BODY})(?=$|[\s|()$]|\\[bs])`,
  "g"
)

const CSS_PROPERTIES = new Set([
  "border-top",
  "border-bottom",
  "border-left",
  "border-right",
  "border-radius",
  "border-color",
  "border-width",
  "border-style",
  "border-collapse",
  "text-align",
  "text-decoration",
  "text-transform",
  "text-overflow",
  "text-indent",
  "text-shadow",
  "font-size",
  "font-weight",
  "font-family",
  "font-style",
  "font-variant",
  "flex-direction",
  "flex-wrap",
  "flex-basis",
  "flex-grow",
  "flex-shrink",
  "flex-flow",
  "z-index",
  "outline-offset",
  "outline-color",
  "outline-style",
  "outline-width",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "row-gap",
  "object-fit",
  "object-position",
  "aspect-ratio",
  "line-height",
  "break-inside",
  "break-after",
  "break-before",
  "place-items",
  "place-content",
  "overflow-wrap",
  "content-visibility",
])

const unescapePattern = (pattern) => pattern.replace(/\\([[\].\/()-])/g, "$1")

const bareUtility = (token) => token.replace(/^.*:/, "").replace(/^!?-?/, "")

export function looksLikeClassText(text, { pattern = false } = {}) {
  if (pattern)
    return [...unescapePattern(text).matchAll(CLASS_IN_PATTERN)].some(
      (match) => !CSS_PROPERTIES.has(bareUtility(match[1]))
    )
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  return (
    tokens.length > 0 &&
    tokens.some((token) => /[-:[]/.test(token)) &&
    tokens.every(
      (token) =>
        CLASS_TOKEN.test(token) && !CSS_PROPERTIES.has(bareUtility(token))
    )
  )
}

const CLASS_TEXT_MATCHERS = new Set([
  "toMatch",
  "toContain",
  "toBe",
  "toEqual",
  "toStrictEqual",
])

const CLASS_MEMBERS = new Set(["className", "classList", "classes"])

function chainReadsClass(node) {
  let current = node
  while (current) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isAsExpression(current)
    ) {
      current = current.expression
      continue
    }
    if (
      ts.isPropertyAccessExpression(current) ||
      ts.isPropertyAccessChain?.(current)
    ) {
      if (CLASS_MEMBERS.has(current.name.text)) return true
      current = current.expression
      continue
    }
    if (ts.isElementAccessExpression(current)) {
      current = current.expression
      continue
    }
    if (ts.isCallExpression(current)) {
      const callee = current.expression
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "getAttribute" &&
        current.arguments[0] &&
        ts.isStringLiteralLike(current.arguments[0]) &&
        current.arguments[0].text === "class"
      )
        return true
      current = callee
      continue
    }
    return false
  }
  return false
}

function classTextIn(node) {
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map(classTextIn).find((text) => text !== null) ?? null
  if (ts.isStringLiteralLike(node))
    return looksLikeClassText(node.text) ? node.text : null
  if (ts.isRegularExpressionLiteral(node)) {
    const pattern = node.text.slice(1, node.text.lastIndexOf("/"))
    return looksLikeClassText(pattern, { pattern: true }) ? node.text : null
  }
  return null
}

function expectCallOf(node) {
  let current = node
  while (current) {
    if (ts.isCallExpression(current)) {
      const callee = current.expression
      if (ts.isIdentifier(callee) && callee.text === "expect") return current
      current = callee
      continue
    }
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression
      continue
    }
    return null
  }
  return null
}

function classAssertionReason(matcher, args, subject) {
  if (matcher === "toHaveClass") return "asserts toHaveClass"
  if (
    matcher === "toHaveAttribute" &&
    args[0] &&
    ts.isStringLiteralLike(args[0]) &&
    args[0].text === "class"
  )
    return "asserts the class attribute"
  if (subject && chainReadsClass(subject)) return "asserts a className read"
  if (!CLASS_TEXT_MATCHERS.has(matcher)) return null
  const pinned = args.map(classTextIn).find((text) => text !== null)
  return pinned === undefined ? null : `asserts the class text ${pinned}`
}

export function testClassAssertions(source, file = "file.test.tsx") {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const problems = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const expectCall = expectCallOf(node.expression.expression)
      if (expectCall) {
        const reason = classAssertionReason(
          node.expression.name.text,
          node.arguments,
          expectCall.arguments[0]
        )
        if (reason) {
          const line =
            sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
              .line + 1
          problems.push(
            `${file}:${line}: ${reason}; assert the role, name, value or what a click does instead`
          )
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return problems
}

export function countsByFile(problems) {
  const counts = {}
  for (const problem of problems) {
    const file = problem.slice(0, problem.indexOf(":"))
    counts[file] = (counts[file] ?? 0) + 1
  }
  return counts
}
