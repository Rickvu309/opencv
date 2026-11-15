export function renderFormattingBlock(block: { type: string }) {
  const dom = globalThis.document.createElement(
    block.type === "divider" ? "hr" : "div"
  )
  dom.dataset.paperBlock = block.type
  if (block.type.startsWith("paperCv") && block.type !== "paperCvField") {
    dom.contentEditable = "false"
    dom.setAttribute("aria-hidden", "true")
    return { dom }
  }
  if (block.type === "divider") return { dom }
  const contentDOM = globalThis.document.createElement("span")
  contentDOM.dataset.paperContent = ""
  dom.append(contentDOM)
  return { dom, contentDOM }
}
