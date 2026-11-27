export const PAPER_EDITOR_DIR = "apps/web/src/features/paper/editor/"
export const PAPER_INPUT_PORT = `${PAPER_EDITOR_DIR}input-port.ts`

export const ONE_INPUT_HINT =
  "the new Paper page reads keys, text and the clipboard only through the hidden textarea in input-port.ts; paint the page from Layout and never make it contenteditable"

const EDITABLE = /\bcontent[Ee]ditable\b|\bdesignMode\b/g
const INPUT_EVENTS =
  "keydown|keyup|keypress|beforeinput|input|textInput|paste|copy|cut|compositionstart|compositionupdate|compositionend"
const LISTENER = new RegExp(
  `addEventListener\\(\\s*["'\`](?:${INPUT_EVENTS})["'\`]`,
  "g"
)
const HANDLER = new RegExp(
  `\\bon(?:${INPUT_EVENTS})\\s*=|\\bon(?:KeyDown|KeyUp|KeyPress|BeforeInput|Input|Paste|Copy|Cut|Composition(?:Start|Update|End))(?:Capture)?\\s*[=:]`,
  "g"
)

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function paperOneInputProblems(source, fileName) {
  if (!fileName.startsWith(PAPER_EDITOR_DIR)) return []
  const problems = []
  for (const match of source.matchAll(EDITABLE))
    problems.push(
      `${fileName}:${lineOf(source, match.index)}: uses ${match[0]}; ${ONE_INPUT_HINT}`
    )
  if (fileName === PAPER_INPUT_PORT) return problems
  for (const pattern of [LISTENER, HANDLER])
    for (const match of source.matchAll(pattern))
      problems.push(
        `${fileName}:${lineOf(source, match.index)}: listens with ${match[0].trim()}; ${ONE_INPUT_HINT}`
      )
  return problems
}
