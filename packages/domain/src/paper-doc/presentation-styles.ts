import { z } from "zod"
import { paragraphStyleValues } from "./paragraph-styles.js"
import {
  inlineSchema,
  inlinePatchSchema,
  paragraphSchema,
  paragraphPatchSchema,
  styleIdSchema,
  parse,
  ok,
  refuse,
  overlay,
  type InlinePresentation,
  type ParagraphPresentation,
  type Result,
  type StyleId,
} from "./presentation-values.js"

const identity = { id: styleIdSchema, parent: styleIdSchema.nullable() }
export const styleSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...identity,
      kind: z.literal("character"),
      values: inlinePatchSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("paragraph"),
      values: paragraphPatchSchema,
    })
    .strict(),
])
export const catalogSchema = z.array(styleSchema).max(128)
type StyleDefinition = z.infer<typeof styleSchema>
type ResolvedStyle =
  | { kind: "character"; id: StyleId; values: InlinePresentation }
  | { kind: "paragraph"; id: StyleId; values: ParagraphPresentation }
type ResolvedStyles = readonly ResolvedStyle[]

export function resolveStyles(input: unknown): Result<ResolvedStyles> {
  const parsed = parse(catalogSchema, input)
  if (parsed.kind === "refused") return parsed
  const catalog = parsed.value
  if (new Set(catalog.map((s) => s.id)).size !== catalog.length)
    return refuse("Duplicate style")
  const resolved: ResolvedStyle[] = []
  const visiting = new Set<StyleId>()
  function visit(style: StyleDefinition): Result<ResolvedStyle> {
    const known = resolved.find((s) => s.id === style.id)
    if (known) return ok(known)
    if (visiting.has(style.id)) return refuse("Style cycle")
    visiting.add(style.id)
    let inherited: object = {}
    if (style.parent !== null) {
      const parent = catalog.find((s) => s.id === style.parent)
      if (!parent || parent.kind !== style.kind)
        return refuse("Missing or wrong-kind parent")
      const result = visit(parent)
      if (result.kind === "refused") return result
      inherited = result.value.values
    }
    const values = overlay(inherited, style.values)
    if ("characterStyle" in values || "paragraphStyle" in values)
      return refuse("Style values cannot reference styles; use parent")
    const result: Result<ResolvedStyle> =
      style.kind === "character"
        ? mapInline(style.id, values)
        : mapParagraph(style.id, values)
    if (result.kind === "refused") return result
    visiting.delete(style.id)
    resolved.push(result.value)
    return result
  }
  for (const style of catalog) {
    const result = visit(style)
    if (result.kind === "refused") return result
  }
  return ok(resolved.sort((a, b) => a.id.localeCompare(b.id, "en")))
}
function mapInline(id: StyleId, values: unknown): Result<ResolvedStyle> {
  const parsed = parse(inlineSchema, values)
  return parsed.kind === "refused"
    ? parsed
    : ok({ kind: "character", id, values: parsed.value })
}
function mapParagraph(id: StyleId, values: unknown): Result<ResolvedStyle> {
  const parsed = parse(paragraphSchema, values)
  return parsed.kind === "refused"
    ? parsed
    : ok({ kind: "paragraph", id, values: parsed.value })
}
export function resolveInline(
  styles: ResolvedStyles,
  reference: StyleId | null,
  overrides: unknown
): Result<InlinePresentation> {
  const patch = parse(inlinePatchSchema, overrides)
  if (patch.kind === "refused") return patch
  if ("characterStyle" in patch.value || "paragraphStyle" in patch.value)
    return refuse("Supply the style reference separately")
  const style =
    reference === null ? undefined : styles.find((s) => s.id === reference)
  if (reference !== null && (!style || style.kind !== "character"))
    return refuse("Missing or wrong-kind style")
  return parse(inlineSchema, overlay(style?.values ?? {}, patch.value))
}
export function resolveParagraph(
  styles: ResolvedStyles,
  reference: StyleId | null,
  overrides: unknown
): Result<ParagraphPresentation> {
  const patch = parse(paragraphPatchSchema, overrides)
  if (patch.kind === "refused") return patch
  if ("characterStyle" in patch.value || "paragraphStyle" in patch.value)
    return refuse("Supply the style reference separately")
  const style =
    reference === null ? undefined : styles.find((s) => s.id === reference)
  const builtin =
    reference === null ? undefined : paragraphStyleValues(reference)
  if (
    reference !== null &&
    ((!style && !builtin) || (style && style.kind !== "paragraph"))
  )
    return refuse("Missing or wrong-kind style")
  return parse(
    paragraphSchema,
    overlay(style?.values ?? builtin ?? {}, patch.value)
  )
}
