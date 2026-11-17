import ts from "typescript"

export const message =
  "Use blankPaper(kind), backed by emptyPaper(kind): a blank has one empty paragraph and no header, sections or formatting."

export function detectDocument(document) {
  const paragraph = document?.blocks?.[0]
  return document?.version === 3 &&
    ["cv", "letter"].includes(document.kind) &&
    Object.keys(document).sort().join(",") === "blocks,clashes,kind,version" &&
    Array.isArray(document.clashes) &&
    document.clashes.length === 0 &&
    document.blocks.length === 1 &&
    paragraph?.type === "paragraph" &&
    typeof paragraph.id === "string" &&
    Object.keys(paragraph).sort().join(",") === "content,id,type" &&
    Array.isArray(paragraph.content) &&
    paragraph.content.length === 0
    ? []
    : [message]
}

export function detect(text, file = "document.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.body &&
      ["blankCv", "blankLetter", "blankPaper", "mintBlankBytes"].includes(
        node.name?.text
      )
    ) {
      const body = node.body?.getText(source) ?? ""
      if (!/\b(blankPaper|emptyPaper)\(/.test(body)) problems.push(message)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
