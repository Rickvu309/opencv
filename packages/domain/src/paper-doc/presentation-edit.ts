import { z } from "zod"
import {
  inlineSchema,
  inlinePatchSchema,
  paragraphSchema,
  paragraphPatchSchema,
  pageSchema,
  pagePropertiesSchema,
  parse,
  canonical,
  ok,
  refuse,
  overlay,
  type Result,
  type StyleId,
} from "./presentation-values.js"
import {
  catalogSchema,
  styleSchema,
  resolveStyles,
  resolveInline,
  resolveParagraph,
} from "./presentation-styles.js"

export const documentPresentationSchema = z
  .object({
    codecVersion: z.literal(1),
    page: pageSchema,
    inline: inlineSchema,
    paragraph: paragraphSchema,
    styles: catalogSchema,
  })
  .strict()
export type DocumentPresentation = z.infer<typeof documentPresentationSchema>
export const rangeSchema = z
  .object({
    ownerId: z.string().min(1).max(128),
    from: z.number().int().min(0).max(1000000),
    to: z.number().int().min(0).max(1000000),
  })
  .strict()
  .refine((r) => r.from < r.to, "Collapsed styles belong to the editor")
export type BodyTextRange = z.infer<typeof rangeSchema>
const snapshotSchema = z
  .object({
    document: documentPresentationSchema,
    blocks: z
      .array(
        z
          .object({
            ownerId: z.string().min(1).max(128),
            paragraph: paragraphSchema,
            runs: z
              .array(
                z
                  .object({
                    text: z.string().max(1000000),
                    values: inlineSchema,
                  })
                  .strict()
              )
              .max(10000),
          })
          .strict()
      )
      .max(10000),
  })
  .strict()
export type PresentationSnapshot = z.infer<typeof snapshotSchema>
const patchSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document-page"), page: pageSchema }).strict(),
  z
    .object({ kind: z.literal("document-inline"), values: inlinePatchSchema })
    .strict(),
  z
    .object({
      kind: z.literal("document-paragraph"),
      values: paragraphPatchSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("named-style"),
      id: styleSchema.options[0].shape.id,
      style: styleSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("body-paragraph"),
      ownerId: z.string().min(1).max(128),
      values: paragraphPatchSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("body-inline"),
      range: rangeSchema,
      values: inlinePatchSchema,
    })
    .strict(),
])
export type PropertyChange =
  | {
      kind: "page"
      before: Partial<DocumentPresentation["page"]>
      after: Partial<DocumentPresentation["page"]>
    }
  | {
      kind: "style"
      id: StyleId
      before: z.infer<typeof styleSchema> | null
      after: z.infer<typeof styleSchema> | null
    }
  | {
      kind: "inline"
      range: BodyTextRange | null
      before: z.infer<typeof inlinePatchSchema>
      after: z.infer<typeof inlinePatchSchema>
    }
  | {
      kind: "paragraph"
      ownerId: string | null
      before: z.infer<typeof paragraphPatchSchema>
      after: z.infer<typeof paragraphPatchSchema>
    }
export const validatedPatchSchema = z
  .object({
    codecVersion: z.literal(1),
    basis: snapshotSchema,
    changes: z
      .array(
        z.discriminatedUnion("kind", [
          z
            .object({
              kind: z.literal("page"),
              before: pagePropertiesSchema.partial(),
              after: pagePropertiesSchema.partial(),
            })
            .strict(),
          z
            .object({
              kind: z.literal("style"),
              id: styleSchema.options[0].shape.id,
              before: styleSchema.nullable(),
              after: styleSchema.nullable(),
            })
            .strict(),
          z
            .object({
              kind: z.literal("inline"),
              range: rangeSchema.nullable(),
              before: inlinePatchSchema,
              after: inlinePatchSchema,
            })
            .strict(),
          z
            .object({
              kind: z.literal("paragraph"),
              ownerId: z.string().min(1).max(128).nullable(),
              before: paragraphPatchSchema,
              after: paragraphPatchSchema,
            })
            .strict(),
        ])
      )
      .max(10000),
  })
  .strict()
export type ValidatedPresentationPatch = z.infer<typeof validatedPatchSchema>

function selected(current: object, patch: object): object {
  const entries = new Map(Object.entries(current))
  return Object.fromEntries(
    Object.keys(patch).map((key) => [key, entries.get(key) ?? null])
  )
}
export function checkSnapshot(input: unknown): Result<PresentationSnapshot> {
  const result = parse(snapshotSchema, input)
  if (result.kind === "refused") return result
  const s = result.value
  if (new Set(s.blocks.map((b) => b.ownerId)).size !== s.blocks.length)
    return refuse("Duplicate owner")
  const styles = resolveStyles(s.document.styles)
  if (styles.kind === "refused") return styles
  const inline = [
    s.document.inline,
    ...s.blocks.flatMap((b) => b.runs.map((r) => r.values)),
  ]
  const paragraphs = [s.document.paragraph, ...s.blocks.map((b) => b.paragraph)]
  for (const value of inline) {
    const { characterStyle, ...overrides } = value
    const resolved = resolveInline(
      styles.value,
      characterStyle ?? null,
      overrides
    )
    if (resolved.kind === "refused") return resolved
  }
  for (const value of paragraphs) {
    const { paragraphStyle, ...overrides } = value
    const resolved = resolveParagraph(
      styles.value,
      paragraphStyle ?? null,
      overrides
    )
    if (resolved.kind === "refused") return resolved
  }
  return result
}
export function isWellFormed(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}
export function validatePresentationPatch(
  input: PresentationSnapshot,
  raw: unknown
): Result<ValidatedPresentationPatch> {
  const checked = checkSnapshot(input)
  if (checked.kind === "refused") return checked
  const parsed = parse(patchSchema, raw)
  if (parsed.kind === "refused") return parsed
  const snapshot = snapshotSchema.parse(checked.value)
  const patch = parsed.value
  const changes: PropertyChange[] = []
  if (patch.kind === "document-page") {
    const keys = Object.keys(patch.page).filter(
      (key) =>
        canonical(Reflect.get(snapshot.document.page, key)) !==
        canonical(Reflect.get(patch.page, key))
    )
    const before = parse(
      pagePropertiesSchema.partial(),
      Object.fromEntries(
        keys.map((k) => [k, Reflect.get(snapshot.document.page, k)])
      )
    )
    const after = parse(
      pagePropertiesSchema.partial(),
      Object.fromEntries(keys.map((k) => [k, Reflect.get(patch.page, k)]))
    )
    if (before.kind === "refused") return before
    if (after.kind === "refused") return after
    changes.push({ kind: "page", before: before.value, after: after.value })
    snapshot.document.page = patch.page
  } else if (patch.kind === "named-style") {
    if (patch.style && patch.style.id !== patch.id)
      return refuse("Style identity mismatch")
    changes.push({
      kind: "style",
      id: patch.id,
      before: snapshot.document.styles.find((s) => s.id === patch.id) ?? null,
      after: patch.style,
    })
    snapshot.document.styles = snapshot.document.styles.filter(
      (s) => s.id !== patch.id
    )
    if (patch.style) snapshot.document.styles.push(patch.style)
  } else if (
    patch.kind === "document-paragraph" ||
    patch.kind === "body-paragraph"
  ) {
    const ownerId = patch.kind === "body-paragraph" ? patch.ownerId : null
    const owner =
      ownerId === null
        ? snapshot.document
        : snapshot.blocks.find((b) => b.ownerId === ownerId)
    if (!owner) return refuse("Missing body owner")
    const before = parse(
      paragraphPatchSchema,
      selected(owner.paragraph, patch.values)
    )
    const after = parse(paragraphSchema, overlay(owner.paragraph, patch.values))
    if (before.kind === "refused") return before
    if (after.kind === "refused") return after
    changes.push({
      kind: "paragraph",
      ownerId,
      before: before.value,
      after: patch.values,
    })
    owner.paragraph = after.value
  } else if (patch.kind === "document-inline") {
    const before = parse(
      inlinePatchSchema,
      selected(snapshot.document.inline, patch.values)
    )
    const after = parse(
      inlineSchema,
      overlay(snapshot.document.inline, patch.values)
    )
    if (before.kind === "refused") return before
    if (after.kind === "refused") return after
    changes.push({
      kind: "inline",
      range: null,
      before: before.value,
      after: patch.values,
    })
    snapshot.document.inline = after.value
  } else {
    const block = snapshot.blocks.find((b) => b.ownerId === patch.range.ownerId)
    if (!block) return refuse("Missing body owner")
    const text = block.runs.map((r) => r.text).join("")
    if (
      patch.range.to > text.length ||
      !isWellFormed(text) ||
      !isWellFormed(text.slice(0, patch.range.from)) ||
      !isWellFormed(text.slice(0, patch.range.to))
    )
      return refuse("Invalid UTF-16 range")
    let offset = 0
    const runs: typeof block.runs = []
    for (const run of block.runs) {
      const from = Math.max(offset, patch.range.from)
      const to = Math.min(offset + run.text.length, patch.range.to)
      if (from < to) {
        const before = parse(
          inlinePatchSchema,
          selected(run.values, patch.values)
        )
        const after = parse(inlineSchema, overlay(run.values, patch.values))
        if (before.kind === "refused") return before
        if (after.kind === "refused") return after
        changes.push({
          kind: "inline",
          range: { ownerId: block.ownerId, from, to },
          before: before.value,
          after: patch.values,
        })
        if (from > offset)
          runs.push({ ...run, text: run.text.slice(0, from - offset) })
        runs.push({
          text: run.text.slice(from - offset, to - offset),
          values: after.value,
        })
        if (to < offset + run.text.length)
          runs.push({ ...run, text: run.text.slice(to - offset) })
      } else runs.push(run)
      offset += run.text.length
    }
    block.runs = runs
  }
  const valid = checkSnapshot(snapshot)
  return valid.kind === "refused"
    ? valid
    : ok({ codecVersion: 1, basis: checked.value, changes })
}
