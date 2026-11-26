import ts from "typescript"

export const message =
  "Use blankCv() or blankLetter(), backed by emptyPaper(kind): a blank has one empty paragraph and no header, sections or formatting."

export const richMessage =
  "Use emptyRichPaper(kind): a rich blank holds only the required empty CV header and one empty paragraph, with no photo, table or formatting."

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

export function detectRichDocument(document) {
  const section = document?.flow?.children?.[0]
  const page = document?.presentation?.page
  const nodes = section?.children ?? []
  const header =
    document?.kind === "cv" && nodes[0]?.type === "header" ? nodes[0] : null
  const paragraph = header ? nodes[1] : nodes[0]
  const headerFieldsEmpty =
    header === null ||
    (Array.isArray(header.children) &&
      header.children.every(
        (field) =>
          field?.type === "cvField" &&
          typeof field.fieldKey === "string" &&
          Object.keys(field).sort().join(",") ===
            "content,fieldKey,id,ownerId,paragraph,type" &&
          Object.keys(field.paragraph ?? {}).length === 0 &&
          Array.isArray(field.content) &&
          field.content.length === 0
      ))
  return document?.version === 4 &&
    document?.schemaRevision === 2 &&
    ["cv", "letter"].includes(document.kind) &&
    document?.profile === "private-layout-3" &&
    Object.keys(document.presentation ?? {})
      .sort()
      .join(",") === "codecVersion,inline,page,paragraph,styles" &&
    Array.isArray(document.presentation?.styles) &&
    document.presentation?.styles?.length === 0 &&
    Object.keys(document.presentation?.paragraph ?? {}).length === 0 &&
    Array.isArray(document.flow?.children) &&
    document.flow.children.length === 1 &&
    section?.type === "flowSection" &&
    section?.start === "continuous" &&
    section?.columns?.count === 1 &&
    page &&
    ["width", "height", "orientation", "top", "bottom", "start", "end"].every(
      (key) => section.page?.[key] === page[key]
    ) &&
    Array.isArray(nodes) &&
    nodes.length === (document.kind === "cv" ? 2 : 1) &&
    headerFieldsEmpty &&
    paragraph?.type === "paragraph" &&
    typeof paragraph.id === "string" &&
    (document.kind !== "letter" || paragraph.id === "letter-1") &&
    Object.keys(paragraph).sort().join(",") === "content,id,paragraph,type" &&
    Object.keys(paragraph.paragraph ?? {}).length === 0 &&
    Array.isArray(paragraph.content) &&
    paragraph.content.length === 0
    ? []
    : [richMessage]
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
