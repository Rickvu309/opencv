import { createHash } from "node:crypto"
import { findCssComments, findSourceComments } from "../no-comments.mjs"

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/i
const CSS_FILE = /\.css$/i
const HTML_FILE = /\.(?:html?|md|svg)$/i

const spanCache = new Map()

function hashKey(file, text) {
  return createHash("sha1").update(file).update("\0").update(text).digest("hex")
}

function htmlCommentSpans(text) {
  const found = []
  for (const match of text.matchAll(/<!--[\s\S]*?-->/g))
    found.push({ start: match.index, end: match.index + match[0].length })
  return found
}

function spansOf(comments) {
  return comments.map((comment) => ({ start: comment.pos, end: comment.end }))
}

function commentSpans(file, text) {
  const key = hashKey(file, text)
  const cached = spanCache.get(key)
  if (cached) return cached
  const spans = HTML_FILE.test(file)
    ? htmlCommentSpans(text)
    : CSS_FILE.test(file)
      ? spansOf(findCssComments(text))
      : SOURCE_FILE.test(file)
        ? spansOf(findSourceComments(file, text))
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
