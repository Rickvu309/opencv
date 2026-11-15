import { isSafeHref } from "@workspace/domain"
import {
  isWellFormed,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import { canonicalStyles } from "./native-formatting-styles.js"
import { attempt } from "./native-formatting.js"
type PasteNode = {
  nodeType: number
  textContent: string | null
  childNodes: ArrayLike<PasteNode>
}
export type FormattingPasteElement = PasteNode & {
  tagName: string
  attributes: ArrayLike<{ name: string; value: string }>
  innerHTML: string
}
function isElement(node: PasteNode): node is FormattingPasteElement {
  return (
    node.nodeType === 1 &&
    "tagName" in node &&
    typeof node.tagName === "string" &&
    "attributes" in node &&
    "innerHTML" in node
  )
}
export function admitFormattingInlineHtml(
  root: FormattingPasteElement
): Result<string> {
  return attempt(() => {
    let count = 0
    const text = root.textContent ?? ""
    if (
      text.length > 1000000 ||
      !isWellFormed(text) ||
      [...text].some((char) => {
        const code = char.charCodeAt(0)
        return code < 9 || (code > 10 && code < 32) || code === 127
      })
    )
      throw new Error("Invalid paste text")
    const visit = (element: FormattingPasteElement) => {
      if (++count > 10000) throw new Error("Paste is too large")
      const tag = element.tagName.toLowerCase()
      const attrs = Object.fromEntries(
        Array.from(element.attributes).map((a) => [a.name, a.value])
      )
      if (tag === "a") {
        if (
          Object.keys(attrs).some((k) => k !== "href") ||
          !isSafeHref(attrs.href ?? "")
        )
          throw new Error("Unsafe pasted link")
      } else if (tag === "span") {
        if (
          Object.keys(attrs).some(
            (k) =>
              ![
                "data-style-type",
                "data-value",
                "data-editable",
                "data-paper-style",
                "data-paper-value",
              ].includes(k)
          )
        )
          throw new Error("Unknown pasted attribute")
        const name = attrs["data-style-type"] ?? attrs["data-paper-style"]
        const value = attrs["data-value"] ?? attrs["data-paper-value"]
        if (
          !name ||
          value === undefined ||
          (attrs["data-paper-style"] !== undefined &&
            attrs["data-paper-style"] !== name) ||
          (attrs["data-paper-value"] !== undefined &&
            attrs["data-paper-value"] !== value)
        )
          throw new Error("Malformed pasted style")
        canonicalStyles({ [name]: value })
      } else if (tag !== "br" || Object.keys(attrs).length)
        throw new Error("Unsupported pasted element")
      for (const child of Array.from(element.childNodes)) {
        if (isElement(child)) visit(child)
        else if (child.nodeType !== 3)
          throw new Error("Unsupported pasted embedding")
      }
    }
    for (const child of Array.from(root.childNodes)) {
      if (isElement(child)) visit(child)
      else if (child.nodeType !== 3)
        throw new Error("Unsupported pasted embedding")
    }
    return root.innerHTML
  })
}
