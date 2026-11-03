import { createHash } from "node:crypto"
import ts from "typescript"

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/i
const CSS_FILE = /\.css$/i
const HTML_FILE = /\.(?:html?|md|svg)$/i

const spanCache = new Map()

export function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX
  if (/\.(?:[cm]?ts)$/.test(file)) return ts.ScriptKind.TS
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX
  return ts.ScriptKind.JS
}

function hashKey(file, text) {
  return createHash("sha1").update(file).update("\0").update(text).digest("hex")
}

function cssCommentSpans(text) {
  const found = []
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === "\\") i++
      else if (char === quote || char === "\n") quote = null
    } else if (char === '"' || char === "'") quote = char
    else if (char === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2)
      const end = close === -1 ? text.length : close + 2
      found.push({ start: i, end })
      i = end - 1
    }
  }
  return found
}

function htmlCommentSpans(text) {
  const found = []
  for (const match of text.matchAll(/<!--[\s\S]*?-->/g))
    found.push({ start: match.index, end: match.index + match[0].length })
  return found
}

function sourceCommentSpans(file, text) {
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    false,
    scriptKind(file)
  )
  const seen = new Map()
  const collect = (ranges) => {
    for (const range of ranges ?? [])
      seen.set(range.pos, { start: range.pos, end: range.end })
  }
  const walk = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) return
    collect(ts.getLeadingCommentRanges(text, node.pos))
    collect(ts.getTrailingCommentRanges(text, node.end))
    for (const child of node.getChildren(sourceFile)) walk(child)
  }
  walk(sourceFile)
  return [...seen.values()]
}

function commentSpans(file, text) {
  const key = hashKey(file, text)
  const cached = spanCache.get(key)
  if (cached) return cached
  const spans = CSS_FILE.test(file)
    ? cssCommentSpans(text)
    : HTML_FILE.test(file)
      ? htmlCommentSpans(text)
      : SOURCE_FILE.test(file)
        ? sourceCommentSpans(file, text)
        : []
  spanCache.set(key, spans)
  return spans
}

function placement(text, file, needle) {
  const spans = commentSpans(file, text)
  let found = false
  let from = 0
  while (from <= text.length) {
    const at = text.indexOf(needle, from)
    if (at < 0) break
    found = true
    const inside = spans.some((span) => at >= span.start && at < span.end)
    if (!inside) return "code"
    from = at + 1
  }
  return found ? "comment" : "absent"
}

export function judge(files, needle, read) {
  const placements = []
  for (const file of files) {
    const text = read(file)
    if (typeof text !== "string") continue
    placements.push(placement(text, file, needle))
  }
  if (placements.length === 0) return null
  if (placements.some((item) => item === "code")) return null
  if (placements.every((item) => item === "absent")) return "appears nowhere"
  return "appears only in a comment"
}
