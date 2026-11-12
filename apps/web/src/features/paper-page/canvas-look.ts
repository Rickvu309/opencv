import type {
  WordAlign,
  WordForm,
  WordMark,
  WordParagraph,
} from "@workspace/domain"

export type MarkSpan = {
  from: number
  to: number
  marks: readonly WordMark[]
}

export type BlockLook = {
  form?: WordForm
  align?: WordAlign
  spans?: readonly MarkSpan[]
}

export type LookEntry = { text: string; look: BlockLook }

export type LookBook = ReadonlyMap<string, LookEntry>

export type DrawnSegment = { text: string; marks: readonly WordMark[] }

type Piece = WordParagraph["pieces"][number]

export function lookOf(
  pieces: readonly Piece[],
  form: WordForm | undefined,
  align: WordAlign | undefined
): BlockLook | undefined {
  const spans: MarkSpan[] = []
  let at = 0
  for (const piece of pieces) {
    const to = at + piece.text.length
    if (piece.marks && piece.text.length > 0)
      spans.push({ from: at, to, marks: piece.marks })
    at = to
  }
  if (!form && !align && spans.length === 0) return undefined
  return {
    ...(form ? { form } : {}),
    ...(align ? { align } : {}),
    ...(spans.length > 0 ? { spans } : {}),
  }
}

export function collectLooks(
  book: LookBook,
  blocks: readonly { id: string; text: string; look?: BlockLook }[]
): LookBook {
  let next: Map<string, LookEntry> | null = null
  for (const block of blocks) {
    const known = book.get(block.id)
    if (!block.look && !known) continue
    if (
      known &&
      block.look &&
      known.text === block.text &&
      JSON.stringify(known.look) === JSON.stringify(block.look)
    )
      continue
    next ??= new Map(book)
    if (block.look) next.set(block.id, { text: block.text, look: block.look })
    else next.delete(block.id)
  }
  return next ?? book
}

export function withoutLooks<T extends { look?: BlockLook }>(
  blocks: readonly T[]
): Omit<T, "look">[] {
  return blocks.map((block) => {
    if (!("look" in block)) return block
    const rest: Partial<T> = { ...block }
    delete rest.look
    return rest as Omit<T, "look">
  })
}

function marksAt(spans: readonly MarkSpan[], length: number) {
  const out: (readonly WordMark[])[] = Array.from({ length }, () => [])
  for (const span of spans)
    for (let index = span.from; index < span.to && index < length; index++)
      out[index] = span.marks
  return out
}

function sharedHead(left: string, right: string) {
  let size = 0
  while (
    size < left.length &&
    size < right.length &&
    left[size] === right[size]
  )
    size++
  return size
}

function sharedTail(left: string, right: string) {
  let size = 0
  while (
    size < left.length &&
    size < right.length &&
    left[left.length - 1 - size] === right[right.length - 1 - size]
  )
    size++
  return size
}

export function typedReach(before: string, text: string, caret: number | null) {
  const tail = Math.min(
    sharedTail(before, text),
    caret === null ? Number.MAX_SAFE_INTEGER : Math.max(0, text.length - caret)
  )
  const head = Math.min(
    sharedHead(before, text),
    before.length - tail,
    text.length - tail
  )
  return { head, tail }
}

function carriedMarks(
  entry: LookEntry,
  text: string,
  caret: number | null
): (readonly WordMark[])[] {
  const before = entry.text
  const marks = marksAt(entry.look.spans ?? [], before.length)
  if (before === text) return marks
  const { head, tail } = typedReach(before, text, caret)
  const typed =
    head > 0
      ? (marks[head - 1] ?? [])
      : tail > 0
        ? (marks[before.length - tail] ?? [])
        : []
  return Array.from(text, (_, index) => {
    if (index < head) return marks[index] ?? []
    if (index >= text.length - tail)
      return marks[before.length - (text.length - index)] ?? []
    return typed
  })
}

function segmentsOf(
  text: string,
  marks: readonly (readonly WordMark[])[]
): DrawnSegment[] {
  const segments: DrawnSegment[] = []
  for (let index = 0; index < text.length; index++) {
    const mark = marks[index] ?? []
    const last = segments.at(-1)
    if (last && last.marks.join(" ") === mark.join(" "))
      last.text += text[index]
    else segments.push({ text: text[index] ?? "", marks: mark })
  }
  return segments
}

export function carryLook(
  entry: LookEntry,
  text: string,
  caret: number | null
): LookEntry {
  if (entry.text === text) return entry
  if (!entry.look.spans?.length) return { text, look: entry.look }
  const spans: MarkSpan[] = []
  let at = 0
  for (const segment of segmentsOf(text, carriedMarks(entry, text, caret))) {
    const to = at + segment.text.length
    if (segment.marks.length > 0)
      spans.push({ from: at, to, marks: segment.marks })
    at = to
  }
  const look: BlockLook = {
    ...(entry.look.form ? { form: entry.look.form } : {}),
    ...(entry.look.align ? { align: entry.look.align } : {}),
    ...(spans.length > 0 ? { spans } : {}),
  }
  return { text, look }
}

export function drawnSegments(
  entry: LookEntry | undefined,
  text: string,
  caret: number | null
): DrawnSegment[] {
  if (!entry?.look.spans?.length || text.length === 0)
    return [{ text, marks: [] }]
  const carried = carryLook(entry, text, caret)
  return segmentsOf(text, marksAt(carried.look.spans ?? [], text.length))
}

const BULLETS = ["•", "◦", "▪"] as const

function letters(value: number): string {
  const rest = Math.floor((value - 1) / 26)
  const letter = String.fromCharCode(97 + ((value - 1) % 26))
  return rest > 0 ? letters(rest) + letter : letter
}

function roman(value: number): string {
  const steps: [number, string][] = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ]
  let left = value
  let out = ""
  for (const [size, glyph] of steps)
    while (left >= size) {
      out += glyph
      left -= size
    }
  return out
}

function numberMarker(value: number, level: number) {
  const step = level % 3
  if (step === 1) return `${letters(value)}.`
  if (step === 2) return `${roman(value)}.`
  return `${value}.`
}

export function listMarkers(
  blocks: readonly { id: string }[],
  formOf: (id: string) => WordForm | undefined
): Map<string, string> {
  const markers = new Map<string, string>()
  let counts: number[] = []
  for (const block of blocks) {
    const form = formOf(block.id)
    if (form?.kind === "title" || form?.kind === "heading") {
      counts = []
      continue
    }
    if (form?.kind !== "bullet" && form?.kind !== "number") continue
    counts = counts.slice(0, form.level + 1)
    if (form.kind === "bullet") {
      markers.set(block.id, BULLETS[form.level % BULLETS.length] ?? "•")
      continue
    }
    const value = (counts[form.level] ?? 0) + 1
    counts[form.level] = value
    markers.set(block.id, numberMarker(value, form.level))
  }
  return markers
}
