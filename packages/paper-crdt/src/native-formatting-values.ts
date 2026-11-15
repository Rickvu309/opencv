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
