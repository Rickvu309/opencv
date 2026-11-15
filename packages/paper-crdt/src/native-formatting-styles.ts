import { formattingStyleConfigs } from "./native-formatting-config.js"
import { createStyleSpec } from "@blocknote/core"
import { canonicalStyles, inlineKeys } from "./native-formatting-values.js"
export {
  canonicalStyles,
  engineStyles,
  inlineKeys,
} from "./native-formatting-values.js"
function implementation(name: (typeof inlineKeys)[number]) {
  return {
    render(value: string) {
      canonicalStyles({ [name]: value })
      const dom = globalThis.document.createElement("span")
      dom.dataset.paperStyle = name
      dom.dataset.paperValue = value
      return { dom, contentDOM: dom }
    },
    parse(element: HTMLElement) {
      if (element.getAttribute("data-paper-style") === name) {
        const value = element.getAttribute("data-paper-value")
        canonicalStyles({ [name]: value })
        return value ?? undefined
      }
      const { tagName, style } = element
      if (name === "bold") {
        if (style.fontWeight === "normal" || style.fontWeight === "400")
          return "off"
        if (
          tagName === "STRONG" ||
          tagName === "B" ||
          style.fontWeight === "bold" ||
          Number(style.fontWeight) >= 600
        )
          return "on"
      }
      if (name === "italic") {
        if (style.fontStyle === "normal") return "off"
        if (tagName === "EM" || tagName === "I" || style.fontStyle === "italic")
          return "on"
      }
      if (name === "underline" || name === "strike") {
        const decoration = style.textDecorationLine || style.textDecoration
        if (decoration === "none") return "off"
        if (
          name === "underline" &&
          (tagName === "U" || decoration.includes("underline"))
        )
          return "on"
        if (
          name === "strike" &&
          (["S", "STRIKE", "DEL"].includes(tagName) ||
            decoration.includes("line-through"))
        )
          return "on"
      }
      return undefined
    },
  }
}
export const formattingStyles = {
  bold: createStyleSpec(formattingStyleConfigs.bold, implementation("bold")),
  italic: createStyleSpec(
    formattingStyleConfigs.italic,
    implementation("italic")
  ),
  underline: createStyleSpec(
    formattingStyleConfigs.underline,
    implementation("underline")
  ),
  strike: createStyleSpec(
    formattingStyleConfigs.strike,
    implementation("strike")
  ),
  color: createStyleSpec(formattingStyleConfigs.color, implementation("color")),
  highlight: createStyleSpec(
    formattingStyleConfigs.highlight,
    implementation("highlight")
  ),
  fontId: createStyleSpec(
    formattingStyleConfigs.fontId,
    implementation("fontId")
  ),
  size: createStyleSpec(formattingStyleConfigs.size, implementation("size")),
  characterStyle: createStyleSpec(
    formattingStyleConfigs.characterStyle,
    implementation("characterStyle")
  ),
}
