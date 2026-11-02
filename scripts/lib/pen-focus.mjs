const INTERACTIVE =
  /(?:^|[\s>+~])(?:button|a|input|textarea|select)(?![\w-])|\[role=["']?(?:button|link|menuitem|tab|option)["']?\]|\[data-slot=["']?(?:button|input|textarea|select-trigger)["']?\]/
const FOCUS_PROPS = /^(?:box-shadow|outline(?:-[a-z]+)?)$/
const GUARDED = /:focus-visible|:focus(?![-\w])|:not\(:focus/

export function cssRules(css) {
  const rules = []
  const stack = []
  let buffer = ""
  let line = 1
  let start = 1
  for (const char of css) {
    if (char === "\n") line += 1
    if (char === "{") {
      stack.push({ head: buffer.trim(), line: start })
      buffer = ""
      start = line
    } else if (char === "}") {
      const open = stack.pop()
      if (open && !open.head.startsWith("@")) {
        rules.push({
          selector: open.head,
          body: buffer,
          line: open.line,
        })
      }
      buffer = ""
      start = line
    } else {
      if (buffer.trim() === "") start = line
      buffer += char
    }
  }
  return rules
}

const bare = (selector) =>
  selector
    .replace(/:{1,2}[\w-]+(?:\([^)]*\))?/g, "")
    .replace(/\s+/g, " ")
    .trim()

export function focusLosses(css) {
  const found = []
  const rules = cssRules(css)
  const restored = new Set(
    rules.flatMap((rule) =>
      rule.selector
        .split(",")
        .filter((selector) => /:focus-visible/.test(selector))
        .map(bare)
    )
  )
  for (const rule of rules) {
    for (const selector of rule.selector.split(",").map((s) => s.trim())) {
      if (GUARDED.test(selector)) continue
      const subject = bare(selector)
      if (!INTERACTIVE.test(subject) || restored.has(subject)) continue
      for (const declaration of rule.body.split(";")) {
        const [property, value] = declaration
          .split(/:(.*)/s)
          .map((s) => s?.trim())
        if (!property || !FOCUS_PROPS.test(property)) continue
        found.push({ line: rule.line, selector, property, value })
      }
    }
  }
  return found
}
