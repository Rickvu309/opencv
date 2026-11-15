import { createStyleSpec } from "@blocknote/core"
import {
  inlineSchema,
  type InlinePresentation,
} from "@workspace/domain/internal/paper-presentation"
export const inlineKeys = [
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "highlight",
  "fontId",
  "size",
  "characterStyle",
] as const
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
  bold: createStyleSpec(
    { type: "bold", propSchema: "string" },
    implementation("bold")
  ),
  italic: createStyleSpec(
    { type: "italic", propSchema: "string" },
    implementation("italic")
  ),
  underline: createStyleSpec(
    { type: "underline", propSchema: "string" },
    implementation("underline")
  ),
  strike: createStyleSpec(
    { type: "strike", propSchema: "string" },
    implementation("strike")
  ),
  color: createStyleSpec(
    { type: "color", propSchema: "string" },
    implementation("color")
  ),
  highlight: createStyleSpec(
    { type: "highlight", propSchema: "string" },
    implementation("highlight")
  ),
  fontId: createStyleSpec(
    { type: "fontId", propSchema: "string" },
    implementation("fontId")
  ),
  size: createStyleSpec(
    { type: "size", propSchema: "string" },
    implementation("size")
  ),
  characterStyle: createStyleSpec(
    { type: "characterStyle", propSchema: "string" },
    implementation("characterStyle")
  ),
}
export function engineStyles(values: InlinePresentation) {
  const checked = inlineSchema.parse(values)
  return {
    ...(checked.bold === undefined
      ? {}
      : { bold: checked.bold ? "on" : "off" }),
    ...(checked.italic === undefined
      ? {}
      : { italic: checked.italic ? "on" : "off" }),
    ...(checked.underline === undefined
      ? {}
      : { underline: checked.underline ? "on" : "off" }),
    ...(checked.strike === undefined
      ? {}
      : { strike: checked.strike ? "on" : "off" }),
    ...(checked.size === undefined ? {} : { size: String(checked.size) }),
    ...(checked.color === undefined ? {} : { color: checked.color }),
    ...(checked.highlight === undefined
      ? {}
      : { highlight: checked.highlight }),
    ...(checked.fontId === undefined ? {} : { fontId: checked.fontId }),
    ...(checked.characterStyle === undefined
      ? {}
      : { characterStyle: checked.characterStyle }),
  }
}
export function canonicalStyles(input: unknown): InlinePresentation {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid styles")
  const values: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!inlineKeys.some((k) => k === key) || typeof value !== "string")
      throw new Error("Unknown style")
    if (["bold", "italic", "underline", "strike"].includes(key)) {
      if (value !== "on" && value !== "off")
        throw new Error("Invalid explicit mark")
      values[key] = value === "on"
    } else if (key === "size") {
      if (!/^[1-9][0-9]*$/.test(value))
        throw new Error("Invalid twips encoding")
      values[key] = Number(value)
    } else values[key] = value
  }
  return inlineSchema.parse(values)
}
