export const PAPER_EDITOR_DIR = "apps/web/src/features/paper/editor/"

export const LAYOUT_OWNS_LINES_HINT =
  "the engine's Layout decides every line break; the painter places its lines and never asks the browser to measure or wrap text"

const MEASURING = /\bmeasureText\s*\(|\bgetClientRects\s*\(/g
const WRAPPING_CSS =
  /white-space\s*:\s*(?:normal|pre-wrap|pre-line|break-spaces)\b/g
const WRAPPING_STYLE =
  /\bwhiteSpace\s*[=:]\s*["'`](?:normal|pre-wrap|pre-line|break-spaces)["'`]/g
const WRAPPING_CLASS =
  /\bwhitespace-(?:normal|pre-wrap|pre-line|break-spaces)\b/g

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function paperLayoutOwnsLinesProblems(source, fileName) {
  if (!fileName.startsWith(PAPER_EDITOR_DIR)) return []
  const patterns = fileName.endsWith(".css")
    ? [WRAPPING_CSS]
    : [MEASURING, WRAPPING_STYLE, WRAPPING_CLASS, WRAPPING_CSS]
  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map(
      (match) =>
        `${fileName}:${lineOf(source, match.index)}: ${match[0].trim()}; ${LAYOUT_OWNS_LINES_HINT}`
    )
  )
}
