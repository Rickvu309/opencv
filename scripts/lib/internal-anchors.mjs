const TEST_FILE = /\.(?:test|spec)\.[jt]sx$/
const FEATURE_FILE = /^apps\/web\/src\/features\/.+\.[jt]sx$/

function internalStart(head) {
  return head.startsWith("/") && !head.startsWith("//")
}

function readCode(source, start, closing) {
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
    if (ch === closing && state === "code" && stack.length === 1)
      return { text: source.slice(start, i + 1), end: i + 1 }
    if (ch === "{" || ch === "(" || ch === "[") {
      stack.push(ch === "{" ? "brace" : ch === "(" ? "paren" : "bracket")
      continue
    }
    if (
      (ch === "}" && state === "brace") ||
      (ch === ")" && state === "paren") ||
      (ch === "]" && state === "bracket")
    )
      stack.pop()
  }
  return null
}

function readLiteral(source, start) {
  const quote = source[start]
  if (quote !== '"' && quote !== "'" && quote !== "`") return null
  let head = ""
  let escape = false
  let braces = 0
  let interpolated = false
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
        interpolated = true
        braces = 1
        i += 1
        continue
      }
      if (braces > 0) {
        if (ch === "{") braces += 1
        else if (ch === "}") braces -= 1
        continue
      }
      if (!interpolated) head += ch
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
  let i = 2
  while (i < tag.length) {
    if (/\s/.test(tag[i])) {
      i += 1
      continue
    }
    if (tag[i] === ">" || tag[i] === "/") return null
    if (tag[i] === "{") {
      const spread = readCode(tag, i + 1, "}")
      if (!spread) return null
      i = spread.end
      continue
    }
    const attribute = /^[\w:-]+/.exec(tag.slice(i))
    if (!attribute) return null
    i += attribute[0].length
    while (/\s/.test(tag[i] ?? "")) i += 1
    if (tag[i] !== "=") continue
    i += 1
    while (/\s/.test(tag[i] ?? "")) i += 1
    const start = i
    const value =
      tag[i] === "{" ? readCode(tag, i + 1, "}") : readLiteral(tag, i)
    if (!value) return null
    if (attribute[0] === name) return tag.slice(start, value.end)
    i = value.end
  }
  return null
}

function internalVariables(source) {
  const variables = new Set()
  const declaration = /\bconst\s+([\w$]+)\s*=\s*/g
  for (const match of source.matchAll(declaration)) {
    const literal = readLiteral(source, match.index + match[0].length)
    if (literal && internalStart(literal.head)) variables.add(match[1])
  }
  return variables
}

function isInternalHref(value, variables) {
  const parens = []
  let previous = ""
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]
    if (ch === '"' || ch === "'" || ch === "`") {
      const literal = readLiteral(value, i)
      if (!literal) return false
      if (!parens.includes(true) && internalStart(literal.head)) return true
      i = literal.end - 1
      previous = ch
      continue
    }
    const identifier = /^[a-zA-Z_$][\w$]*/.exec(value.slice(i))
    if (identifier) {
      const name = identifier[0]
      if (
        !parens.includes(true) &&
        previous !== "." &&
        (name === "SURFACE_PATHS" || variables.has(name))
      )
        return true
      i += name.length - 1
      previous = name
      continue
    }
    if (ch === "(") parens.push(/[\w$)\]]$/.test(previous))
    else if (ch === ")") parens.pop()
    if (!/\s/.test(ch)) previous = ch
  }
  return false
}

export function detect(source, file = "fixture.tsx") {
  const hits = []
  const variables = internalVariables(source)
  const open = /<a(?=[\s/>])/g
  let match = open.exec(source)
  while (match) {
    const tag = readCode(source, match.index, ">")
    if (!tag) break
    const href = attributeAt(tag.text, "href")
    if (href && isInternalHref(href, variables)) {
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
