import { isSafeHref } from "@workspace/domain"
import {
  formatRunsSchema,
  mergeFormatRuns,
  type FormatRun,
} from "@workspace/domain/internal/paper-presentation"
import { canonicalStyles, engineStyles } from "./native-formatting-values.js"
export function object(
  input: unknown,
  keys?: readonly string[]
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected object")
  const result = Object.fromEntries(Object.entries(input))
  if (keys && Object.keys(result).some((k) => !keys.includes(k)))
    throw new Error("Unknown property")
  return result
}
export function array(input: unknown): unknown[] {
  if (!Array.isArray(input)) throw new Error("Expected array")
  return input
}
export function string(input: unknown): string {
  if (typeof input !== "string") throw new Error("Expected string")
  return input
}
export function inlineOf(input: readonly FormatRun[]) {
  return input.map(({ text, href, ...marks }) => {
    const part = { type: "text" as const, text, styles: engineStyles(marks) }
    return href === undefined
      ? part
      : { type: "link" as const, href, content: [part] }
  })
}
export function runsOf(input: unknown): FormatRun[] {
  const out: unknown[] = []
  const text = (value: unknown, href?: string) => {
    const part = object(value, ["type", "text", "styles"])
    if (part.type !== "text") throw new Error("Unknown inline type")
    const valueText = string(part.text)
    if (valueText)
      out.push({
        text: valueText,
        ...canonicalStyles(part.styles),
        ...(href === undefined ? {} : { href }),
      })
    else canonicalStyles(part.styles)
  }
  for (const inputPart of array(input)) {
    const part = object(inputPart)
    if (part.type === "text") text(inputPart)
    else {
      object(part, ["type", "href", "content"])
      if (
        part.type !== "link" ||
        typeof part.href !== "string" ||
        !isSafeHref(part.href)
      )
        throw new Error("Invalid link")
      array(part.content).forEach((v) => text(v, string(part.href)))
    }
  }
  return mergeFormatRuns(formatRunsSchema.parse(out))
}
