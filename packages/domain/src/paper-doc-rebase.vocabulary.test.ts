import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperDocumentSchema,
  type PaperDocument,
} from "./paper-doc/document.ts"
import { rebasePending } from "./paper-doc/rebase.ts"

function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const below = (n: number) => Math.floor(next() * n)
  return { next, below, pick: <T>(items: T[]) => items[below(items.length)]! }
}

const CASES = Number(process.env.PAPER_REBASE_CASES ?? 400)
const FIRST = Number(process.env.PAPER_REBASE_FIRST ?? 1)

type Mark = "plain" | "bold" | "italic"

function markedDocument(words: [string, Mark][]): PaperDocument {
  const content = words.flatMap(([text, mark], at) => [
    ...(at > 0 ? [{ text: " " }] : []),
    mark === "bold"
      ? { text, bold: true }
      : mark === "italic"
        ? { text, italic: true }
        : { text },
  ])
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: [{ id: "p", type: "paragraph", content }],
    clashes: [],
  })
}

function markedWords(doc: PaperDocument): [string, Mark][] {
  const runs = (
    doc.blocks[0] as unknown as {
      content: { text: string; bold?: boolean; italic?: boolean }[]
    }
  ).content
  return runs.flatMap((run) =>
    run.text
      .split(/\s+/)
      .filter(Boolean)
      .map((text): [string, Mark] => [
        text,
        run.bold ? "bold" : run.italic ? "italic" : "plain",
      ])
  )
}

const VOCABULARY = ["I", "to", "the", "a", "and"]

function echoes(a: string[], b: string[]) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  const head = long.slice(0, short.length)
  const tail = long.slice(long.length - short.length)
  return (
    short.every((w, n) => w === head[n]) || short.every((w, n) => w === tail[n])
  )
}

describe("rebasePending over a repeated vocabulary", () => {
  it(`keeps each side's insertion contiguous and in order across ${CASES} cases`, () => {
    for (let seed = FIRST; seed < FIRST + CASES; seed += 1) {
      const random = rng(seed)
      const phrase = () =>
        Array.from({ length: 1 + random.below(4) }, () =>
          random.pick(VOCABULARY)
        )
      const base = Array.from({ length: 2 + random.below(4) }, () =>
        random.pick(VOCABULARY)
      )
      const mine = phrase()
      const other = phrase()
      const at = random.below(base.length + 1)
      const to = random.below(base.length + 1)
      const tag = (words: string[], mark: Mark): [string, Mark][] =>
        words.map((word) => [word, mark])
      const ours = [
        ...tag(base.slice(0, at), "plain"),
        ...tag(mine, "bold"),
        ...tag(base.slice(at), "plain"),
      ]
      const theirs = [
        ...tag(base.slice(0, to), "plain"),
        ...tag(other, "italic"),
        ...tag(base.slice(to), "plain"),
      ]
      const merged = markedWords(
        rebasePending({
          base: markedDocument(tag(base, "plain")),
          ours: markedDocument(ours),
          theirs: markedDocument(theirs),
        }).document
      )
      const words = merged.map(([word]) => word)
      const fail = (what: string) =>
        assert.fail(
          `seed ${seed}: ${what} ${JSON.stringify({ base, mine, other, at, to, merged })}`
        )
      if (at === to && echoes(mine, other)) continue
      const order = (mark: Mark) =>
        merged.filter(([, m]) => m === mark).map(([word]) => word)
      if (order("bold").join(" ") !== mine.join(" "))
        fail("person words changed")
      if (order("italic").join(" ") !== other.join(" "))
        fail("other words changed")
      for (const mark of ["bold", "italic"] as const) {
        const at = merged.findIndex(([, m]) => m === mark)
        const last = merged.map(([, m]) => m).lastIndexOf(mark)
        const inside = merged.slice(at, last + 1).every(([, m]) => m === mark)
        if (!inside) fail(`${mark} insertion is not contiguous`)
      }
      if (words.length !== base.length + mine.length + other.length) {
        fail("word count is off")
      }
    }
  })
})
