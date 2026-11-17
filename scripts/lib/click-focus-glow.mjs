const ACCENT_TOKEN = /var\(--(?:ring|primary)\)/
const CSS_GLOW =
  /(?:^|[;\s])(?:box-shadow|outline)\s*:[^;]*var\(--(?:ring|primary)\)/
const TEXT_ENTRY =
  /\b(?:input|textarea)\b|contenteditable|role="?textbox|paper-canvas-field/
const TEXT_ENTRY_SLOT = /\b(?:input|textarea)\b|input-group-control/
const KIT_TEXT_FIELDS =
  /^packages\/ui\/src\/components\/(?:input|textarea|input-group)\.tsx$/
const ACCENT_UTILITY =
  /^(?:ring-(?:ring|primary)(?:\/|$)|shadow-\[[^\]]*--(?:ring|primary))/

export const QUIET_FOCUS_HINT =
  "show focus on a text field with the caret and a neutral border (focus-visible:border-muted-foreground/50, as in the kit Input), never a coloured ring or shadow"

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

function cssGlows(source, fileName) {
  const problems = []
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].replace(/\s+/g, " ").trim()
    if (!clickFocusSelector(selector)) continue
    if (!CSS_GLOW.test(match[2])) continue
    const line = source.slice(0, match.index).split("\n").length
    problems.push(
      `${fileName}:${line}: ${selector} draws a coloured glow when clicked; ${QUIET_FOCUS_HINT}`
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

function classGlows(source, fileName) {
  const problems = []
  const lines = source.split("\n")
  lines.forEach((text, index) => {
    for (const token of text.split(/[\s"'`{}(),]+/)) {
      if (!token.includes(":")) continue
      const { variant, utility } = splitUtility(token)
      if (!ACCENT_UTILITY.test(utility)) continue
      if (!clickFocusVariant(variant, fileName)) continue
      problems.push(
        `${fileName}:${index + 1}: ${token} draws a coloured glow when clicked; ${QUIET_FOCUS_HINT}`
      )
    }
  })
  return problems
}

export function clickFocusGlows(source, fileName = "file.tsx") {
  if (fileName.endsWith(".css")) return cssGlows(source, fileName)
  if (!ACCENT_TOKEN.test(source) && !/ring-(?:ring|primary)/.test(source))
    return []
  return [...new Set(classGlows(source, fileName))]
}
