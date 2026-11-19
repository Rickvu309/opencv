const ACCENT = "(?:ring|primary)"
const ALARM = "(?:ring|primary|destructive)"
const CSS_FOCUS_GLOW = new RegExp(
  `(?:^|[;\\s])(?:box-shadow|outline|border(?:-[a-z-]+)?)\\s*:[^;]*var\\(--${ACCENT}\\)`
)
const CSS_INVALID_GLOW = new RegExp(
  `(?:^|[;\\s])(?:box-shadow|outline)\\s*:[^;]*var\\(--${ALARM}\\)`
)
const TEXT_ENTRY =
  /\b(?:input|textarea)\b|contenteditable|role="?textbox|paper-canvas-field/
const TEXT_ENTRY_SLOT = /\b(?:input|textarea)\b|input-group-control/
const TOKEN_EDGE = /[\s"'`{}(),]/
const TEXT_ENTRY_TAG = /<(?:input|textarea|Input|Textarea|InputGroup\w*)\b/
const KIT_TEXT_FIELDS =
  /^packages\/ui\/src\/components\/(?:input|textarea|input-group)\.tsx$/
const KIT_FORM_FIELDS =
  /^packages\/ui\/src\/components\/(?:input|textarea|input-group|select)\.tsx$/
const FOCUS_GLOW_UTILITY = new RegExp(
  `^(?:(?:ring|outline|border(?:-[xytrbse])?)-${ACCENT}(?:\\/|$)|shadow-\\[[^\\]]*--${ACCENT})`
)
const INVALID_GLOW_UTILITY = new RegExp(
  `^(?:ring(?:-(?!0$|transparent$|inset$|offset)\\S+)?$|shadow-\\[[^\\]]*--${ALARM}|outline-${ALARM}(?:\\/|$))`
)

export const QUIET_FOCUS_HINT =
  "show focus on a text field with the caret and a neutral border (focus-visible:border-muted-foreground/50, as in the kit Input) and a refused value with a red border only (aria-invalid:border-destructive), never a coloured border, underline, ring or shadow"

function withoutNot(selector) {
  let out = ""
  let depth = 0
  for (let i = 0; i < selector.length; i++) {
    if (depth === 0 && selector.startsWith(":not(", i)) {
      depth = 1
      i += 4
      continue
    }
    if (depth > 0) {
      if (selector[i] === "(") depth++
      else if (selector[i] === ")") depth--
      continue
    }
    out += selector[i]
  }
  return out
}

function clickFocusSelector(selector) {
  const plain = withoutNot(selector)
  if (/:focus-within\b/.test(plain)) return true
  if (/:focus(?![-\w])/.test(plain)) return true
  return /:focus-visible\b/.test(plain) && TEXT_ENTRY.test(plain)
}

function invalidFieldSelector(selector) {
  const plain = withoutNot(selector)
  return /aria-invalid/.test(plain) && TEXT_ENTRY.test(plain)
}

function cssGlows(source, fileName) {
  const problems = []
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].replace(/\s+/g, " ").trim()
    const focusGlow =
      clickFocusSelector(selector) && CSS_FOCUS_GLOW.test(match[2])
    const invalidGlow =
      invalidFieldSelector(selector) && CSS_INVALID_GLOW.test(match[2])
    if (!focusGlow && !invalidGlow) continue
    const line = source.slice(0, match.index).split("\n").length
    problems.push(
      `${fileName}:${line}: ${selector} draws a coloured glow when clicked or refused; ${QUIET_FOCUS_HINT}`
    )
  }
  return problems
}

function splitUtility(token) {
  let depth = 0
  let cut = -1
  for (let i = 0; i < token.length; i++) {
    if (token[i] === "[") depth++
    else if (token[i] === "]") depth--
    else if (token[i] === ":" && depth === 0) cut = i
  }
  return cut < 0
    ? { variant: "", utility: token }
    : { variant: token.slice(0, cut), utility: token.slice(cut + 1) }
}

function clickFocusVariant(variant, fileName) {
  if (/(?:^|:)focus-within(?:$|:)/.test(variant)) return true
  if (/(?:^|:)focus(?:$|:)/.test(variant)) return true
  const inside = variant.match(/has-\[(.*)\]/)?.[1]
  if (inside && /:focus(?:-within)?(?![-\w])/.test(inside)) return true
  if (inside && /:focus-visible/.test(inside) && TEXT_ENTRY_SLOT.test(inside))
    return true
  return (
    KIT_TEXT_FIELDS.test(fileName) &&
    /(?:^|:)focus-visible(?:$|:)/.test(variant)
  )
}

function invalidVariant(variant, fileName, line) {
  if (!/(?:^|:|\[)aria-invalid\b|has-\[[^\]]*aria-invalid/.test(variant))
    return false
  return KIT_FORM_FIELDS.test(fileName) || TEXT_ENTRY_TAG.test(line)
}

function classTokens(line) {
  const tokens = []
  let token = ""
  let depth = 0
  for (const char of line) {
    if (depth === 0 && TOKEN_EDGE.test(char)) {
      if (token) tokens.push(token)
      token = ""
      continue
    }
    if (char === "[") depth++
    else if (char === "]") depth = Math.max(0, depth - 1)
    token += char
  }
  if (token) tokens.push(token)
  return tokens
}

function classGlows(source, fileName) {
  const problems = []
  const lines = source.split("\n")
  lines.forEach((text, index) => {
    for (const token of classTokens(text)) {
      if (!token.includes(":")) continue
      const { variant, utility } = splitUtility(token)
      const focusGlow =
        FOCUS_GLOW_UTILITY.test(utility) && clickFocusVariant(variant, fileName)
      const invalidGlow =
        INVALID_GLOW_UTILITY.test(utility) &&
        invalidVariant(variant, fileName, text)
      if (!focusGlow && !invalidGlow) continue
      problems.push(
        `${fileName}:${index + 1}: ${token} draws a coloured glow when clicked or refused; ${QUIET_FOCUS_HINT}`
      )
    }
  })
  return problems
}

export function clickFocusGlows(source, fileName = "file.tsx") {
  if (fileName.endsWith(".css")) return cssGlows(source, fileName)
  return [...new Set(classGlows(source, fileName))]
}
