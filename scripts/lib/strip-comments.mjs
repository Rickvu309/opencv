import ts from "typescript"
import { SOURCE_FILE, bannedComments } from "../no-comments.mjs"

const isBlank = (line) => line.trim() === ""

function emptyJsxExpressions(file, text) {
  if (!/\.[jt]sx$/.test(file)) return []
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind
  )
  const found = []
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) {
      found.push([node.getStart(sourceFile), node.end])
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function lineStartOf(text, line) {
  let offset = 0
  for (let current = 1; current < line; current++) {
    offset = text.indexOf("\n", offset) + 1
  }
  return offset
}

function locateComments(file, text) {
  const located = []
  let cursor = 0
  for (const comment of bannedComments(file, text)) {
    const from = text.indexOf(
      comment.raw,
      Math.max(lineStartOf(text, comment.line), cursor)
    )
    if (from === -1) continue
    located.push([from, from + comment.raw.length])
    cursor = from + comment.raw.length
  }
  return located
}

function widen(range, containers, text) {
  const container = containers.find(
    ([start, end]) => start <= range[0] && range[1] <= end
  )
  const [from, to] = container ?? range
  let end = to
  while (/[ \t]/.test(text[from - 1] ?? "") && /[ \t]/.test(text[end] ?? "x"))
    end++
  return [from, end]
}

function dropEmptiedLine(text, at) {
  const lineStart = at === 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1
  const nextBreak = text.indexOf("\n", at)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const line = text.slice(lineStart, lineEnd)
  if (!isBlank(line))
    return text.slice(0, lineStart) + line.trimEnd() + text.slice(lineEnd)
  const previous = text
    .slice(0, Math.max(lineStart - 1, 0))
    .split("\n")
    .pop()
  const following = text.slice(lineEnd + 1).split("\n", 1)[0]
  const leavesTwoBlanks =
    (lineStart === 0 || previous === "") &&
    nextBreak !== -1 &&
    isBlank(following)
  const cut = leavesTwoBlanks ? text.indexOf("\n", lineEnd + 1) : lineEnd
  return (
    text.slice(0, lineStart) + text.slice(cut === -1 ? text.length : cut + 1)
  )
}

export function stripComments(file, text) {
  if (!SOURCE_FILE.test(file) && !/\.css$/.test(file)) return text
  const containers = emptyJsxExpressions(file, text)
  let result = text
  for (const range of locateComments(file, text).reverse()) {
    const [from, to] = widen(range, containers, text)
    result = dropEmptiedLine(result.slice(0, from) + result.slice(to), from)
  }
  return result
}
