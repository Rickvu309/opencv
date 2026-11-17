const TEST_FILE = /\.(?:test|spec)\.[jt]sx$/
const FEATURE_FILE = /^apps\/web\/src\/features\/.+\.[jt]sx$/

function internalStart(head) {
  return head.startsWith("/") && !head.startsWith("//")
}

function readOpeningTag(source, start) {
  const stack = ["code"]
  let escape = false
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    const state = stack[stack.length - 1]
    if (state === "string" || state === "char") {
      if (escape) {
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (
        (state === "string" && ch === '"') ||
        (state === "char" && ch === "'")
      )
        stack.pop()
      continue
    }
    if (state === "template") {
      if (escape) {
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (ch === "`") stack.pop()
      else if (ch === "$" && source[i + 1] === "{") {
        stack.push("brace")
        i += 1
      }
      continue
    }
    if (ch === '"') {
      stack.push("string")
      continue
    }
    if (ch === "'") {
      stack.push("char")
      continue
    }
    if (ch === "`") {
      stack.push("template")
      continue
    }
    if (ch === "{") {
      stack.push("brace")
      continue
    }
    if (ch === "}" && state === "brace") {
      stack.pop()
      continue
    }
    if (ch === ">" && state === "code" && stack.length === 1)
      return { text: source.slice(start, i + 1), end: i + 1 }
  }
  return null
}

function readLiteral(source, start) {
  const quote = source[start]
  if (quote !== '"' && quote !== "'" && quote !== "`") return null
  let head = ""
  let escape = false
  let braces = 0
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i]
    if (quote === "`") {
      if (escape) {
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (braces === 0 && ch === "`")
        return { end: i + 1, head, kind: "template" }
      if (braces === 0 && ch === "$" && source[i + 1] === "{") {
        braces = 1
        i += 1
        continue
      }
      if (braces > 0) {
        if (ch === "{") braces += 1
        else if (ch === "}") braces -= 1
        continue
      }
      head += ch
      continue
    }
    if (escape) {
      escape = false
      continue
    }
    if (ch === "\\") {
      escape = true
      continue
    }
    if (ch === quote) return { end: i + 1, head, kind: "string" }
    head += ch
  }
  return null
}

function attributeAt(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*`).exec(tag)
  if (!match) return null
  return tag.slice(match.index + match[0].length)
}

function isInternalHref(value) {
  if (/\bSURFACE_PATHS\b/.test(value)) return true
  let paren = 0
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]
    if (ch === '"' || ch === "'" || ch === "`") {
      const literal = readLiteral(value, i)
      if (!literal) return false
      if (paren === 0 && internalStart(literal.head)) return true
      i = literal.end - 1
      continue
    }
    if (ch === "(") paren += 1
    else if (ch === ")" && paren > 0) paren -= 1
  }
  return false
}

export function detect(source, file = "fixture.tsx") {
  const hits = []
  const open = /<a(?=[\s/>])/g
  let match = open.exec(source)
  while (match) {
    const tag = readOpeningTag(source, match.index)
    if (!tag) break
    const href = attributeAt(tag.text, "href")
    if (href && isInternalHref(href)) {
      const line = source.slice(0, match.index).split("\n").length
      hits.push(`${file}:${line} raw internal anchor`)
    }
    open.lastIndex = tag.end
    match = open.exec(source)
  }
  return hits
}

export function isFeatureSource(file) {
  return FEATURE_FILE.test(file) && !TEST_FILE.test(file)
}

export function anchorCounts(files, read) {
  const counts = {}
  for (const file of files.filter(isFeatureSource).sort()) {
    const found = detect(read(file), file)
    if (found.length > 0) counts[file] = found.length
  }
  return counts
}
