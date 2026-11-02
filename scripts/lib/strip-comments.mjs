import ts from "typescript"
import {
  CSS_FILE,
  SOURCE_FILE,
  bannedComments,
  cssTemplatePieces,
  findCssComments,
} from "../no-comments.mjs"

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

function sliceOut(text, from, to) {
  let result = ""
  let cursor = from
  for (const comment of findCssComments(text, from, to)) {
    result += text.slice(cursor, comment.pos)
    cursor = comment.end
  }
  return result + text.slice(cursor, to)
}

function withoutSpace(text) {
  return text.replace(/\s+/g, "")
}

function codeSignature(file, text) {
  if (CSS_FILE.test(file)) return withoutSpace(sliceOut(text, 0, text.length))
  const kind = /\.tsx$/.test(file)
    ? ts.ScriptKind.TSX
    : /\.[cm]?ts$/.test(file)
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JSX
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind
  )
  const cssStarts = new Map(
    cssTemplatePieces(file, text).map((piece) => [piece.start - 1, piece])
  )
  const parts = []
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) return
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    )
      return
    if (node.getChildCount(sourceFile) > 0) {
      for (const child of node.getChildren(sourceFile)) visit(child)
      return
    }
    if (node.kind === ts.SyntaxKind.JsxText) {
      parts.push(withoutSpace(node.getText(sourceFile)))
      return
    }
    const piece = cssStarts.get(node.getStart(sourceFile))
    if (piece) {
      parts.push(
        `css:${withoutSpace(sliceOut(text, piece.start, piece.end))}\0`
      )
      return
    }
    parts.push(`${node.kind}:${node.getText(sourceFile)}\0`)
  }
  visit(sourceFile)
  return parts.join("")
}

function syntaxErrorCount(file, text) {
  const { diagnostics } = ts.transpileModule(text, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.Latest,
    },
  })
  return diagnostics.length
}

export class StripRefused extends Error {}

export function assertCodeUnchanged(file, before, after) {
  if (
    !CSS_FILE.test(file) &&
    syntaxErrorCount(file, after) > syntaxErrorCount(file, before)
  )
    throw new StripRefused(
      `${file}: stripping its comments left code that does not parse`
    )
  if (codeSignature(file, before) !== codeSignature(file, after))
    throw new StripRefused(
      `${file}: stripping its comments changed code, not only comments`
    )
}

function glue(text, from, to) {
  const touchesWord =
    /\w/.test(text[from - 1] ?? "") && /\w/.test(text[to] ?? "")
  return touchesWord ? " " : ""
}

export function stripComments(file, text) {
  if (!SOURCE_FILE.test(file) && !CSS_FILE.test(file)) return text
  const containers = emptyJsxExpressions(file, text)
  let result = text
  const ranges = bannedComments(file, text).map((comment) => [
    comment.pos,
    comment.end,
  ])
  for (const range of ranges.reverse()) {
    const [from, to] = widen(range, containers, text)
    result = dropEmptiedLine(
      result.slice(0, from) + glue(result, from, to) + result.slice(to),
      from
    )
  }
  assertCodeUnchanged(file, text, result)
  return result
}
