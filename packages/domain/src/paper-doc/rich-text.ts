import { z } from "zod"

declare const safeHrefBrand: unique symbol
export type SafeHref = string & { readonly [safeHrefBrand]: true }

const SAFE_HREF_PATTERN = /^(?:https?:\/\/[^\s/?#]|mailto:\S)/i
const MAX_HREF_LENGTH = 2000
const HREF_EDGE_CHARACTER = /[\s\p{Cc}]/u

function isControlCode(code: number): boolean {
  return code < 32 || code === 127
}

export function isSafeHref(value: string): value is SafeHref {
  return (
    value.length <= MAX_HREF_LENGTH &&
    SAFE_HREF_PATTERN.test(value) &&
    !/\s/.test(value) &&
    !/\p{Cf}/u.test(value) &&
    ![...value].some((char) => isControlCode(char.charCodeAt(0)))
  )
}

function safeHrefOf(value: string | undefined): SafeHref | undefined {
  if (value === undefined) return undefined
  let start = 0
  let end = value.length
  while (start < end && HREF_EDGE_CHARACTER.test(value.charAt(start)))
    start += 1
  while (end > start && HREF_EDGE_CHARACTER.test(value.charAt(end - 1)))
    end -= 1
  if (end - start > MAX_HREF_LENGTH) return undefined
  const trimmed = value.slice(start, end)
  return isSafeHref(trimmed) ? trimmed : undefined
}

export const safeHrefSchema = z
  .string()
  .refine(isSafeHref, "Only http, https and mailto links are allowed")
  .transform((value) => value as SafeHref)

export type TextRun = {
  text: string
  bold?: true
  italic?: true
  underline?: true
  href?: SafeHref
}

declare const richTextBrand: unique symbol
export type RichText = readonly TextRun[] & { readonly [richTextBrand]: true }

const TAB = 9
const NEWLINE = 10

function withoutControlCharacters(text: string): string {
  let result = ""
  const chars = [...text.replace(/\r\n?/g, "\n")]
  for (const char of chars) {
    const code = char.charCodeAt(0)
    const kept = code === TAB || code === NEWLINE
    result += isControlCode(code) && !kept ? " " : char
  }
  return result
}

type Marks = Omit<TextRun, "text">
type CheckedMarks = { [K in keyof Marks]: Marks[K] | undefined }

function runOf(text: string, marks: CheckedMarks): TextRun {
  return {
    text,
    ...(marks.bold ? { bold: true as const } : {}),
    ...(marks.italic ? { italic: true as const } : {}),
    ...(marks.underline ? { underline: true as const } : {}),
    ...(marks.href ? { href: marks.href } : {}),
  }
}

function sameMarks(left: CheckedMarks, right: CheckedMarks): boolean {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    left.href === right.href
  )
}

export function normalizeRuns(runs: readonly TextRun[]): RichText {
  const normalized: TextRun[] = []
  for (const run of runs) {
    const text = withoutControlCharacters(run.text)
    if (text === "") continue
    const marks: CheckedMarks = { ...run, href: safeHrefOf(run.href) }
    const last = normalized[normalized.length - 1]
    if (last && sameMarks(last, marks)) {
      normalized[normalized.length - 1] = runOf(last.text + text, last)
    } else {
      normalized.push(runOf(text, marks))
    }
  }
  return normalized as unknown as RichText
}

export function plainTextOfRuns(text: RichText): string {
  return text.map((run) => run.text).join("")
}

export function richTextOf(plain: string): RichText {
  return normalizeRuns([{ text: plain }])
}

const ESCAPABLE = new Set(["\\", "*", "[", "]", "(", ")"])

function closeIndex(source: string, from: number, token: string): number {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1
      continue
    }
    if (source.startsWith(token, index)) return index
  }
  return -1
}

function destinationEnd(source: string, from: number): number {
  let depth = 0
  for (let index = from; index < source.length; index += 1) {
    const char = source[index]
    if (char === "\\") index += 1
    else if (char === "(") depth += 1
    else if (char === ")") {
      if (depth === 0) return index
      depth -= 1
    }
  }
  return -1
}

function unescapeText(escaped: string): string {
  return escaped.replace(/\\([\\*[\]()])/g, "$1")
}

function openingToken(
  source: string,
  index: number,
  marks: Marks
): { token: string; marks: Marks } | null {
  if (source.startsWith("***", index) && !marks.bold && !marks.italic) {
    return { token: "***", marks: { ...marks, bold: true, italic: true } }
  }
  if (source.startsWith("**", index) && !marks.bold) {
    return { token: "**", marks: { ...marks, bold: true } }
  }
  if (source[index] === "*" && !marks.italic) {
    return { token: "*", marks: { ...marks, italic: true } }
  }
  return null
}

function parseInline(source: string, marks: Marks): TextRun[] {
  const runs: TextRun[] = []
  let buffer = ""
  const flush = () => {
    if (buffer !== "") runs.push(runOf(buffer, marks))
    buffer = ""
  }
  let index = 0
  while (index < source.length) {
    const char = source[index] as string
    const following = source[index + 1]
    if (char === "\\" && following !== undefined && ESCAPABLE.has(following)) {
      buffer += following
      index += 2
      continue
    }
    const opening = openingToken(source, index, marks)
    if (opening) {
      const innerStart = index + opening.token.length
      const close = closeIndex(source, innerStart, opening.token)
      if (close > innerStart) {
        flush()
        runs.push(
          ...parseInline(source.slice(innerStart, close), opening.marks)
        )
        index = close + opening.token.length
        continue
      }
      buffer += opening.token
      index = innerStart
      continue
    }
    if (char === "[" && !marks.href) {
      const labelEnd = closeIndex(source, index + 1, "]")
      const hrefEnd =
        labelEnd > 0 && source[labelEnd + 1] === "("
          ? destinationEnd(source, labelEnd + 2)
          : -1
      if (hrefEnd > 0) {
        const href = unescapeText(source.slice(labelEnd + 2, hrefEnd))
        flush()
        runs.push(
          ...parseInline(
            source.slice(index + 1, labelEnd),
            isSafeHref(href) ? { ...marks, href } : marks
          )
        )
        index = hrefEnd + 1
        continue
      }
    }
    buffer += char
    index += 1
  }
  flush()
  return runs
}

function richTextFromInlineMarkdown(source: string): RichText {
  return normalizeRuns(parseInline(source, {}))
}

const textRunSchema = z
  .object({
    text: z.string().min(1),
    bold: z.literal(true).optional(),
    italic: z.literal(true).optional(),
    underline: z.literal(true).optional(),
    href: safeHrefSchema.optional(),
  })
  .strict()

const richTextSchema: z.ZodType<RichText> = z
  .array(textRunSchema)
  .transform((runs) => normalizeRuns(runs))

export const richTextInputSchema: z.ZodType<RichText> = z.union([
  richTextSchema,
  z.string().transform((source) => richTextFromInlineMarkdown(source)),
])
