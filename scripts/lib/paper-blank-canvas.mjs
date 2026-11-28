import ts from "typescript"

export const message =
  "Use blankCv() or blankLetter(), backed by emptyPaper(kind): a blank has one empty paragraph and no header, sections or formatting."

const ONE_INCH_MPT = 72000
const plainParagraph = {
  kind: "paragraph",
  list: null,
  level: 0,
  align: "left",
  lineSpacing: null,
  keepWithNext: null,
}

const keysOf = (value) =>
  Object.keys(value ?? {})
    .sort()
    .join(",")

export function detectDocument(document) {
  const page = document?.attrs?.page
  const block = document?.content?.[0]
  const attrs = block?.attrs ?? {}
  const kind = document?.attrs?.template === "letter" ? "letter" : "cv"
  return document?.type === "doc" &&
    keysOf(document) === "attrs,content,type" &&
    keysOf(document.attrs) === "page,schema,template" &&
    document.attrs.schema === 1 &&
    ["classic", "letter"].includes(document.attrs.template) &&
    page?.size === "A4" &&
    page?.orientation === "portrait" &&
    keysOf(page.marginsMpt) === "bottom,left,right,top" &&
    Object.values(page.marginsMpt).every((mpt) => mpt === ONE_INCH_MPT) &&
    Array.isArray(document.content) &&
    document.content.length === 1 &&
    block?.type === "text_block" &&
    keysOf(block) === "attrs,type" &&
    keysOf(attrs) === "align,id,keepWithNext,kind,level,lineSpacing,list" &&
    typeof attrs.id === "string" &&
    (kind !== "letter" || attrs.id === "letter-1") &&
    Object.entries(plainParagraph).every(([key, value]) => attrs[key] === value)
    ? []
    : [message]
}

const startingShape = [
  /\bpaperEngineBlank\.blankCv\(\)/,
  /\bpaperEngineBlank\.blankLetter\(\)/,
  /return content\.length \? \{ \.\.\.blank, content \} : blank\b/,
]

export function detect(text, file = "document.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.body) {
      const name = node.name?.text
      const body = node.body.getText(source)
      if (
        ["blankCv", "blankLetter", "blankPaper", "mintBlankBytes"].includes(
          name
        )
      ) {
        const shared = /\b(blankPaper|emptyPaper)\(/.test(body)
        const dispatch =
          name === "blankPaper" &&
          /\bblankCv\(\)/.test(body) &&
          /\bblankLetter\(\)/.test(body)
        if (!shared && !dispatch) problems.push(message)
      }
      if (
        name === "startingPage" &&
        !startingShape.every((pattern) => pattern.test(body))
      )
        problems.push(message)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
