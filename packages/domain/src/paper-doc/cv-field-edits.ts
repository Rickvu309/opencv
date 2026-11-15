import { z } from "zod"

import {
  cvFieldSchema,
  cvRichTextSchema,
  type CvField,
  type CvFieldRange,
  type CvFieldTarget,
} from "./cv-fields.js"
import {
  cvOwners,
  nativeCvDocumentSchema,
  type NativeCvDocument,
} from "./native-cv.js"
import {
  normalizeRuns,
  plainTextOfRuns,
  type RichText,
  type TextRun,
  safeHrefSchema,
} from "./rich-text.js"

export type CvFieldEdit = {
  readonly candidate: NativeCvDocument
  readonly effects: readonly {
    target: CvFieldTarget
    before: RichText
    after: RichText
  }[]
}
export type CvFieldMarks = {
  bold?: true | null
  italic?: true | null
  underline?: true | null
  href?: TextRun["href"] | null
}

export function resolveCvField(
  document: NativeCvDocument,
  target: CvFieldTarget
): CvField {
  const checked = nativeCvDocumentSchema.parse(document)
  const owner = cvOwners(checked).find((node) => node.id === target.ownerId)
  const field = owner?.children.find((node) => node.id === target.fieldId)
  if (
    !field ||
    field.type !== "cvField" ||
    field.fieldKey !== target.fieldKey ||
    field.itemId !== target.itemId
  )
    throw new Error("Stale or mismatched CV field target")
  return field
}

function slice(content: RichText, from: number, to: number): RichText {
  let offset = 0
  return normalizeRuns(
    content.flatMap((run) => {
      const start = Math.max(0, from - offset)
      const end = Math.min(run.text.length, to - offset)
      offset += run.text.length
      return end > start ? [{ ...run, text: run.text.slice(start, end) }] : []
    })
  )
}

function selected(
  document: NativeCvDocument,
  range: CvFieldRange,
  expected: RichText
): CvField {
  const field = resolveCvField(document, range)
  const text = plainTextOfRuns(field.content)
  const boundary = (n: number) =>
    !(
      n > 0 &&
      n < text.length &&
      /[\uD800-\uDBFF]/u.test(text[n - 1] ?? "") &&
      /[\uDC00-\uDFFF]/u.test(text[n] ?? "")
    )
  if (
    !Number.isInteger(range.from) ||
    !Number.isInteger(range.to) ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > text.length ||
    !boundary(range.from) ||
    !boundary(range.to)
  )
    throw new Error("Invalid UTF16 field range")
  const checked = cvRichTextSchema.parse(expected)
  if (
    JSON.stringify(slice(field.content, range.from, range.to)) !==
    JSON.stringify(checked)
  )
    throw new Error("Selected rich text changed")
  return field
}

function replaced(
  document: NativeCvDocument,
  range: CvFieldRange,
  field: CvField,
  replacement: RichText
): CvFieldEdit {
  const content = normalizeRuns([
    ...slice(field.content, 0, range.from),
    ...replacement,
    ...slice(field.content, range.to, plainTextOfRuns(field.content).length),
  ])
  cvFieldSchema.parse({ ...field, content })
  const candidate = nativeCvDocumentSchema.parse(document)
  const owner = cvOwners(candidate).find((node) => node.id === range.ownerId)
  if (!owner) throw new Error("Missing owner")
  owner.children = owner.children.map((node) =>
    node.id === field.id ? { ...field, content } : node
  )
  return {
    candidate: nativeCvDocumentSchema.parse(candidate),
    effects: [
      {
        target: {
          ownerId: range.ownerId,
          fieldId: range.fieldId,
          fieldKey: range.fieldKey,
          ...(range.itemId ? { itemId: range.itemId } : {}),
        },
        before: field.content,
        after: content,
      },
    ],
  }
}

export function replaceCvFieldRange(
  document: NativeCvDocument,
  range: CvFieldRange,
  expected: RichText,
  replacement: RichText
): CvFieldEdit {
  const field = selected(document, range, expected)
  return replaced(document, range, field, cvRichTextSchema.parse(replacement))
}

export function formatCvFieldRange(
  document: NativeCvDocument,
  range: CvFieldRange,
  expected: RichText,
  marks: CvFieldMarks
): CvFieldEdit {
  const field = selected(document, range, expected)
  const checkedMarks = z
    .object({
      bold: z.literal(true).nullable().optional(),
      italic: z.literal(true).nullable().optional(),
      underline: z.literal(true).nullable().optional(),
      href: safeHrefSchema.nullable().optional(),
    })
    .strict()
    .parse(marks)
  const replacement = slice(field.content, range.from, range.to).map((run) => {
    const next = { ...run }
    for (const key of ["bold", "italic", "underline", "href"] as const) {
      const value = checkedMarks[key]
      if (value === null) delete next[key]
      else if (value !== undefined) Object.assign(next, { [key]: value })
    }
    return next
  })
  return replaced(document, range, field, cvRichTextSchema.parse(replacement))
}
