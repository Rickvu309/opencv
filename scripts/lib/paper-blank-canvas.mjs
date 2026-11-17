import ts from "typescript"

export const message =
  "Use blankCv() or blankLetter(), backed by emptyPaper(kind): a blank has one empty paragraph and no header, sections or formatting."

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
    (document.kind !== "letter" || paragraph.id === "letter-1") &&
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
      const shared = /\b(blankPaper|emptyPaper)\(/.test(body)
      const dispatch =
        node.name?.text === "blankPaper" &&
        /\bblankCv\(\)/.test(body) &&
        /\bblankLetter\(\)/.test(body)
      if (!shared && !dispatch) problems.push(message)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}

export function detectHeaderEdit(text) {
  const source = ts.createSourceFile(
    "edits.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const edit = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "setHeaderEdit"
  )
  const body = edit?.body?.getText(source) ?? ""
  const creation = body.indexOf("work.header ??=")
  const lookup = body.indexOf("find(work, context, HEADER_NODE_ID)")
  return creation >= 0 && creation < lookup
    ? []
    : [
        "setHeaderEdit must create an explicitly requested CV header before looking it up.",
      ]
}

export function detectHeaderUndo(text) {
  const source = ts.createSourceFile(
    "undo.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const undo = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "stripCreated"
  )
  const body = undo?.body?.getText(source) ?? ""
  const deletion = body.indexOf("delete work.header")
  const splice = body.indexOf("entry.list!.splice")
  return body.includes('entry.owner === "header"') &&
    deletion >= 0 &&
    deletion < splice
    ? []
    : [
        "Undo must remove a newly added CV header from the document header field.",
      ]
}

export function detectHeaderRebase(text, file = "rebase.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "withMergedHeader" &&
      node.body &&
      !/\bmergeHeader\(\{/.test(node.body.getText(source))
    )
      problems.push(
        "Header presence and fields must be merged against the base and empty header defaults."
      )
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
