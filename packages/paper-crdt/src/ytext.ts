import diff from "fast-diff"
import * as Y from "yjs"

export type Run = {
  readonly text: string
  readonly attributes: Record<string, unknown>
}

type Delta = { insert?: unknown; attributes?: Record<string, unknown> }

const EMBED = "￼"

function canonical(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : inner
  )
}

function textsOf(content: Y.XmlElement): Y.XmlText[] {
  return content.toArray().filter((child) => child instanceof Y.XmlText)
}

function chunkOf(op: Delta): string {
  return typeof op.insert === "string" ? op.insert : EMBED
}

export function textOf(content: Y.XmlElement): string {
  return textsOf(content)
    .flatMap((text) => text.toDelta() as Delta[])
    .map(chunkOf)
    .join("")
}

function locate(texts: Y.XmlText[], pos: number, forInsert: boolean) {
  let start = 0
  for (const text of texts) {
    const end = start + text.length
    if (forInsert ? pos <= end : pos < end) {
      return { text, offset: pos - start }
    }
    start = end
  }
  const last = texts[texts.length - 1]
  if (!last) throw new Error("A paragraph with no text cannot be edited")
  return { text: last, offset: last.length }
}

function removeRange(texts: Y.XmlText[], pos: number, length: number): void {
  let left = length
  while (left > 0) {
    const { text, offset } = locate(texts, pos, false)
    const count = Math.min(left, text.length - offset)
    text.delete(offset, count)
    left -= count
  }
}

function piecesOf(runs: readonly Run[], from: number, to: number): Run[] {
  const pieces: Run[] = []
  let start = 0
  for (const run of runs) {
    const end = start + run.text.length
    const lo = Math.max(from, start)
    const hi = Math.min(to, end)
    if (lo < hi) {
      pieces.push({
        text: run.text.slice(lo - start, hi - start),
        attributes: run.attributes,
      })
    }
    start = end
  }
  return pieces
}

function patchOf(
  current: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(target)) {
    if (canonical(value) !== canonical(current[key])) patch[key] = value
  }
  for (const key of Object.keys(current)) {
    if (!(key in target)) patch[key] = null
  }
  return Object.keys(patch).length > 0 ? patch : null
}

function editCharacters(
  texts: Y.XmlText[],
  runs: readonly Run[],
  target: string
): void {
  const current = texts
    .flatMap((text) => text.toDelta() as Delta[])
    .map(chunkOf)
    .join("")
  let pos = 0
  let targetPos = 0
  for (const [kind, chunk] of diff(current, target)) {
    if (kind === diff.EQUAL) {
      pos += chunk.length
      targetPos += chunk.length
    } else if (kind === diff.DELETE) {
      removeRange(texts, pos, chunk.length)
    } else {
      for (const piece of piecesOf(runs, targetPos, targetPos + chunk.length)) {
        const place = locate(texts, pos, true)
        place.text.insert(place.offset, piece.text, { ...piece.attributes })
        pos += piece.text.length
      }
      targetPos += chunk.length
    }
  }
}

function editFormats(texts: Y.XmlText[], runs: readonly Run[]): void {
  let cursor = 0
  const bounds = runs.map((run) => {
    const from = cursor
    cursor += run.text.length
    return { from, to: cursor, attributes: run.attributes }
  })
  let pos = 0
  for (const text of texts) {
    let offset = 0
    for (const op of text.toDelta() as Delta[]) {
      const length = chunkOf(op).length
      for (const bound of bounds) {
        const from = Math.max(bound.from, pos)
        const to = Math.min(bound.to, pos + length)
        if (from >= to) continue
        const patch = patchOf(op.attributes ?? {}, bound.attributes)
        if (patch) text.format(offset + (from - pos), to - from, patch)
      }
      pos += length
      offset += length
    }
  }
}

export function syncRuns(content: Y.XmlElement, runs: readonly Run[]): void {
  const texts = textsOf(content)
  const target = runs.map((run) => run.text).join("")
  if (texts.length === 0) {
    if (target === "") return
    const created = new Y.XmlText()
    content.insert(content.length, [created])
    created.applyDelta(
      runs.map((run) => ({ insert: run.text, attributes: run.attributes }))
    )
    return
  }
  editCharacters(texts, runs, target)
  editFormats(texts, runs)
}
