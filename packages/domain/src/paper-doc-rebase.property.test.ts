import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperDocumentSchema,
  type PaperDocument,
} from "./paper-doc/document.ts"
import { rebasePending } from "./paper-doc/rebase.ts"

type Word = { w: string; bold: boolean }
type Block = {
  id: string
  type: "paragraph" | "heading" | "bullet" | "numbered"
  level: 2 | 3
  words: Word[]
  children: Block[]
}

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

type Random = ReturnType<typeof rng>

const isList = (type: string) => type === "bullet" || type === "numbered"

function toDocument(blocks: Block[]): PaperDocument {
  const runs = (words: Word[]) =>
    words.flatMap((word, at) => [
      ...(at > 0 ? [{ text: " " }] : []),
      word.bold ? { text: word.w, bold: true } : { text: word.w },
    ])
  const node = (block: Block): Record<string, unknown> => ({
    id: block.id,
    type: block.type,
    ...(block.type === "heading" ? { level: block.level } : {}),
    content: runs(block.words),
    ...(isList(block.type) ? { children: block.children.map(node) } : {}),
  })
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: blocks.map(node),
    clashes: [],
  })
}

function copy(blocks: Block[]): Block[] {
  return structuredClone(blocks)
}

function every(blocks: Block[], into: Block[] = []): Block[] {
  for (const block of blocks) {
    into.push(block)
    every(block.children, into)
  }
  return into
}

function listOf(blocks: Block[], target: Block): Block[] | null {
  if (blocks.includes(target)) return blocks
  for (const block of blocks) {
    const found = listOf(block.children, target)
    if (found) return found
  }
  return null
}

function depthOf(blocks: Block[], target: Block, depth = 1): number {
  for (const block of blocks) {
    if (block === target) return depth
    const inner = depthOf(block.children, target, depth + 1)
    if (inner > 0) return inner
  }
  return 0
}

function height(block: Block): number {
  return 1 + Math.max(0, ...block.children.map(height))
}

function baseOf(random: Random, counter: { word: number; block: number }) {
  const make = (depth: number): Block => {
    const type =
      depth === 1
        ? random.pick([
            "paragraph",
            "heading",
            "bullet",
            "bullet",
            "numbered",
          ] as const)
        : random.pick(["bullet", "numbered"] as const)
    const id = `k${counter.block++}`
    const words = Array.from({ length: 1 + random.below(5) }, () => ({
      w: `b${counter.word++}`,
      bold: false,
    }))
    const kids =
      isList(type) && depth < 3 && random.next() < 0.5
        ? Array.from({ length: 1 + random.below(2) }, () => make(depth + 1))
        : []
    const level = random.next() < 0.5 ? 2 : 3
    return { id, type, level, words, children: kids }
  }
  return Array.from({ length: 3 + random.below(4) }, () => make(1))
}

const TOP_TYPES = ["paragraph", "heading", "bullet", "numbered"] as const

function retype(
  random: Random,
  blocks: Block[],
  block: Block,
  siblings: Block[],
  moved: string[]
) {
  const at = siblings.indexOf(block)
  const choices =
    siblings === blocks ? TOP_TYPES : (["bullet", "numbered"] as const)
  const next = random.pick(choices.filter((type) => type !== block.type))
  if (next === "heading") block.level = random.next() < 0.5 ? 2 : 3
  if (isList(block.type) && !isList(next)) {
    siblings.splice(at + 1, 0, ...block.children)
    moved.push(...block.children.map((kid) => kid.id))
    block.children = []
  }
  block.type = next
}

function splitAt(block: Block, siblings: Block[], blocks: Block[], id: string) {
  if (block.words.length < 2) return
  const cut = 1 + Math.floor(block.words.length / 2 - 0.5)
  siblings.splice(siblings.indexOf(block) + 1, 0, {
    id,
    type: block.type === "heading" ? "paragraph" : block.type,
    level: 2,
    words: block.words.splice(Math.min(cut, block.words.length - 1)),
    children: [],
  })
  void blocks
}

function movedWordBlocks(source: Block[], base: Block[]) {
  const holder = new Map<string, string>()
  for (const block of every(source)) {
    for (const word of block.words) holder.set(word.w, block.id)
  }
  const moved = new Set<string>()
  for (const block of every(base)) {
    if (
      block.words.some(
        (word) => holder.has(word.w) && holder.get(word.w) !== block.id
      )
    ) {
      moved.add(block.id)
    }
  }
  return moved
}

function noteStructural(facts: Facts, id: string, side: "p" | "t") {
  facts.counts[side] += 1
  if (facts.counts[side] > 1) facts.composite = true
  if (facts.edited.has(id)) facts.composite = true
  facts.joined.push(id)
}

function joinPrevious(
  block: Block,
  siblings: Block[],
  facts: Facts,
  side: "p" | "t"
) {
  const at = siblings.indexOf(block)
  const previous = siblings[at - 1]
  if (
    at === 0 ||
    block.children.length > 0 ||
    block.type === "heading" ||
    previous?.type !== block.type
  ) {
    return
  }
  if (facts.hosts.has(block.id) || facts.joined.includes(previous.id)) {
    facts.composite = true
  }
  previous.words.push(...block.words)
  siblings.splice(at, 1)
  noteStructural(facts, block.id, side)
  facts.hosts.add(previous.id)
}

type Facts = {
  movedByPerson: string[]
  movedByServer: string[]
  restructured: Set<string>
  joined: string[]
  hosts: Set<string>
  counts: { p: number; t: number }
  edited: Set<string>
  composite: boolean
  splitBySide: Set<string>
}

function splitOwn(
  facts: Facts,
  side: "p" | "t",
  block: Block,
  siblings: Block[],
  blocks: Block[],
  id: string
) {
  facts.splitBySide.add(`${side}:${block.id}`)
  facts.splitBySide.add(`${side}:${id}`)
  splitAt(block, siblings, blocks, id)
}

function personEdits(
  random: Random,
  blocks: Block[],
  counter: { word: number; block: number },
  facts: Facts
) {
  let restructured = false
  const steps = 1 + random.below(5)
  for (let step = 0; step < steps; step += 1) {
    const all = every(blocks)
    if (all.length === 0) return
    const block = random.pick(all)
    const siblings = listOf(blocks, block)!
    const at = siblings.indexOf(block)
    const op = random.below(15)
    if (op <= 3 && facts.hosts.has(block.id)) facts.composite = true
    if (op <= 3) facts.edited.add(block.id)
    if (op <= 4 && facts.splitBySide.has(`p:${block.id}`)) {
      facts.composite = true
    }
    if (op === 0 || op === 1) {
      block.words.splice(random.below(block.words.length + 1), 0, {
        w: `p${counter.word++}`,
        bold: false,
      })
    } else if (op === 2 && block.words.length > 0) {
      block.words.splice(random.below(block.words.length), 1)
    } else if (op === 3 && block.words.length > 0) {
      block.words.splice(random.below(block.words.length), 1, {
        w: `p${counter.word++}`,
        bold: false,
      })
    } else if (op === 4 && block.words.length > 0) {
      random.pick(block.words).bold = true
    } else if (op === 5 && !restructured) {
      restructured = true
      noteStructural(facts, block.id, "p")
      facts.restructured.add(block.id)
      splitOwn(facts, "p", block, siblings, blocks, `s${counter.block++}`)
    } else if (op === 6) {
      joinPrevious(block, siblings, facts, "p")
    } else if (op === 7) {
      siblings.splice(at + 1, 0, {
        id: `a${counter.block++}`,
        type: siblings === blocks ? "paragraph" : "bullet",
        level: 2,
        words: [{ w: `p${counter.word++}`, bold: false }],
        children: [],
      })
    } else if (op === 8 && blocks.length > 1) {
      if (facts.restructured.has(block.id)) facts.composite = true
      siblings.splice(at, 1)
    } else if (op === 9 && siblings === blocks && blocks.length > 1) {
      const [moved] = blocks.splice(at, 1)
      blocks.splice(random.below(blocks.length + 1), 0, moved!)
      facts.movedByPerson.push(moved!.id)
    } else if (
      op === 10 &&
      at > 0 &&
      isList(block.type) &&
      isList(siblings[at - 1]!.type) &&
      depthOf(blocks, block) + height(block) <= 3
    ) {
      siblings.splice(at, 1)
      siblings[at - 1]!.children.push(block)
      facts.movedByPerson.push(block.id)
    } else if (op === 11) {
      retype(random, blocks, block, siblings, facts.movedByPerson)
    } else if (op === 12 && !restructured) {
      restructured = true
      noteStructural(facts, block.id, "p")
      facts.restructured.add(block.id)
      splitOwn(facts, "p", block, siblings, blocks, `s${counter.block++}`)
    } else if (op === 13 && !restructured) {
      restructured = true
      joinPrevious(block, siblings, facts, "p")
    } else if (op === 14 && block.type === "heading") {
      block.level = block.level === 2 ? 3 : 2
    }
  }
}

function otherEdits(
  random: Random,
  blocks: Block[],
  counter: { word: number; block: number },
  facts: Facts
) {
  let restructured = false
  const steps = 1 + random.below(4)
  for (let step = 0; step < steps; step += 1) {
    const all = every(blocks)
    if (all.length === 0) return
    const block = random.pick(all)
    const siblings = listOf(blocks, block)!
    const at = siblings.indexOf(block)
    const op = random.below(9)
    if (op === 0 && facts.hosts.has(block.id)) facts.composite = true
    if (op === 0) facts.edited.add(block.id)
    if (op === 0 && facts.splitBySide.has(`t:${block.id}`)) {
      facts.composite = true
    }
    if (op === 0 && block.words.length > 0) {
      block.words.splice(random.below(block.words.length), random.below(2), {
        w: `t${counter.word++}`,
        bold: false,
      })
    } else if (op === 1) {
      siblings.splice(at + 1, 0, {
        id: `n${counter.block++}`,
        type: siblings === blocks ? "paragraph" : "bullet",
        level: 2,
        words: [{ w: `t${counter.word++}`, bold: false }],
        children: [],
      })
    } else if (op === 2 && isList(block.type) && depthOf(blocks, block) < 3) {
      block.children.push({
        id: `n${counter.block++}`,
        type: block.type,
        level: 2,
        words: [{ w: `t${counter.word++}`, bold: false }],
        children: [],
      })
    } else if (op === 3 && siblings === blocks && blocks.length > 1) {
      const [moved] = blocks.splice(at, 1)
      blocks.splice(random.below(blocks.length + 1), 0, moved!)
      facts.movedByServer.push(moved!.id)
    } else if (op === 4 && blocks.length > 1) {
      if (facts.restructured.has(block.id)) facts.composite = true
      siblings.splice(at, 1)
    } else if (op === 5 && block.type === "heading") {
      block.level = block.level === 2 ? 3 : 2
    } else if (op === 6) {
      retype(random, blocks, block, siblings, facts.movedByServer)
    } else if (op === 7 && !restructured) {
      restructured = true
      noteStructural(facts, block.id, "t")
      facts.restructured.add(block.id)
      splitOwn(facts, "t", block, siblings, blocks, `y${counter.block++}`)
    } else if (op === 8 && !restructured) {
      restructured = true
      joinPrevious(block, siblings, facts, "t")
    }
  }
}

function wordsIn(blocks: Block[]) {
  const found = new Map<string, { block: string; bold: boolean }>()
  for (const block of every(blocks)) {
    for (const word of block.words) {
      found.set(word.w, { block: block.id, bold: word.bold })
    }
  }
  return found
}

type Flat = {
  id: string
  parent: string
  at: number
  words: Word[]
  type: string
  level?: number
}

function flatOf(doc: PaperDocument): Flat[] {
  const out: Flat[] = []
  const visit = (nodes: Record<string, unknown>[], parent: string) => {
    nodes.forEach((node, at) => {
      const runs = (node.content ?? []) as { text: string; bold?: boolean }[]
      const words: Word[] = []
      for (const run of runs) {
        for (const w of run.text.split(/\s+/).filter(Boolean)) {
          words.push({ w, bold: run.bold === true })
        }
      }
      out.push({
        id: String(node.id),
        parent,
        at,
        words,
        type: String(node.type),
        ...(node.type === "heading" ? { level: Number(node.level) } : {}),
      })
      visit((node.children ?? []) as Record<string, unknown>[], String(node.id))
    })
  }
  visit(doc.blocks as never, "body")
  return out
}

function subsequence(whole: string[], part: string[]) {
  let at = 0
  for (const item of whole) if (item === part[at]) at += 1
  return at === part.length
}

function checkCase(seed: number) {
  const random = rng(seed)
  const counter = { word: 1, block: 1 }
  const base = baseOf(random, counter)
  const facts: Facts = {
    movedByPerson: [],
    movedByServer: [],
    restructured: new Set(),
    joined: [],
    hosts: new Set(),
    counts: { p: 0, t: 0 },
    edited: new Set(),
    composite: false,
    splitBySide: new Set(),
  }
  const ours = copy(base)
  const theirs = copy(base)
  personEdits(random, ours, { word: counter.word, block: counter.block }, facts)
  otherEdits(
    random,
    theirs,
    { word: counter.word + 500, block: counter.block + 500 },
    facts
  )
  const movedOurs = movedWordBlocks(ours, base)
  for (const id of movedWordBlocks(theirs, base)) {
    if (movedOurs.has(id)) facts.composite = true
  }
  const rebased = rebasePending({
    base: toDocument(base),
    ours: toDocument(ours),
    theirs: toDocument(theirs),
  })
  const result = flatOf(rebased.document)
  const fail = (what: string) =>
    assert.fail(
      `seed ${seed}: ${what} ${JSON.stringify({ ...facts, restructured: [...facts.restructured] })}\n${JSON.stringify({ base, ours, theirs, result })}`
    )

  if (rebased.failed) fail("the merge fell back to keeping blocks beside")
  const ids = result.map((entry) => entry.id)
  if (new Set(ids).size !== ids.length) fail("an id is used twice")
  const resultWords = result.flatMap((entry) =>
    entry.words.map((word) => word.w)
  )
  const baseWords = wordsIn(base)
  const ourWords = wordsIn(ours)
  const theirWords = wordsIn(theirs)
  const count = (word: string) => resultWords.filter((w) => w === word).length

  for (const word of resultWords) {
    if (!ourWords.has(word) && !theirWords.has(word)) fail(`invented ${word}`)
  }
  for (const [word, where] of ourWords) {
    if (!baseWords.has(word)) {
      if (count(word) !== 1)
        fail(`person word ${word} appears ${count(word)} times`)
      const bold = result
        .flatMap((entry) => entry.words)
        .find((w) => w.w === word)!
      if (bold.bold !== where.bold) fail(`person word ${word} lost its mark`)
    }
  }
  for (const [word] of theirWords) {
    if (!baseWords.has(word) && count(word) !== 1)
      fail(`other word ${word} appears ${count(word)} times`)
  }
  for (const [word, where] of baseWords) {
    const mine = ourWords.get(word)
    const other = theirWords.get(word)
    const oursHasBlock = ours.some((b) =>
      every([b]).some((x) => x.id === where.block)
    )
    const theirsHasBlock = theirs.some((b) =>
      every([b]).some((x) => x.id === where.block)
    )
    if (count(word) > 1 && !facts.composite)
      fail(`base word ${word} appears ${count(word)} times`)
    if (mine && other && count(word) < 1) fail(`lost shared word ${word}`)
    if (
      !mine &&
      other &&
      other.block === where.block &&
      oursHasBlock &&
      theirsHasBlock &&
      count(word) !== 0
    ) {
      fail(`word ${word} the person deleted came back`)
    }
    if (
      mine &&
      !other &&
      mine.block === where.block &&
      oursHasBlock &&
      theirsHasBlock &&
      count(word) !== 0
    ) {
      fail(`word ${word} the other side deleted came back`)
    }
    if (
      !facts.composite &&
      mine &&
      !baseWords.get(word)!.bold &&
      mine.bold &&
      count(word) === 1
    ) {
      const found = result
        .flatMap((entry) => entry.words)
        .find((w) => w.w === word)!
      if (!found.bold) fail(`person's bold on ${word} was lost`)
    }
  }

  const oursFlat = flatOf(toDocument(ours))
  const theirsFlat = flatOf(toDocument(theirs))
  for (const entry of result) {
    const mine = oursFlat.find((x) => x.id === entry.id)
    const other = theirsFlat.find((x) => x.id === entry.id)
    const here = entry.words.map((word) => word.w)
    for (const side of [mine, other]) {
      if (!side) continue
      const kept = side.words
        .map((word) => word.w)
        .filter((w) => here.includes(w))
      if (!subsequence(here, kept))
        fail(`order of ${entry.id} breaks a side's order`)
    }
  }
  for (const added of oursFlat) {
    if (!baseWords && !result.some((entry) => entry.id === added.id))
      fail("added block missing")
  }
  const baseIds = new Set(every(base).map((b) => b.id))
  for (const added of oursFlat) {
    if (
      !baseIds.has(added.id) &&
      !result.some((entry) => entry.id === added.id)
    ) {
      fail(`person-added block ${added.id} is missing`)
    }
  }
  for (const entry of result) {
    const mine = oursFlat.find((x) => x.id === entry.id)
    const other = theirsFlat.find((x) => x.id === entry.id)
    if (
      mine &&
      other &&
      facts.movedByPerson.length === 1 &&
      facts.movedByPerson[0] === entry.id &&
      facts.movedByServer.length <= 1 &&
      !facts.movedByServer.includes(entry.id)
    ) {
      if (
        isList(entry.type) &&
        entry.parent !== mine.parent &&
        result.some((x) => x.id === mine.parent && isList(x.type))
      ) {
        fail(`person's move of ${entry.id} was undone`)
      }
    }
    if (
      mine &&
      other &&
      facts.movedByServer.length === 1 &&
      facts.movedByServer[0] === entry.id &&
      facts.movedByPerson.length <= 1 &&
      !facts.movedByPerson.includes(entry.id)
    ) {
      if (
        isList(entry.type) &&
        entry.parent !== other.parent &&
        result.some((x) => x.id === other.parent && isList(x.type))
      ) {
        fail(`other side's move of ${entry.id} was undone`)
      }
    }
  }
  const baseFlat = flatOf(toDocument(base))
  for (const entry of result) {
    const before = baseFlat.find((x) => x.id === entry.id)
    const mine = oursFlat.find((x) => x.id === entry.id)
    const other = theirsFlat.find((x) => x.id === entry.id)
    if (!before || !mine || !other) continue
    const want = mine.type !== before.type ? mine : other
    if (entry.type !== want.type)
      fail(`${entry.id} is a ${entry.type}, not the ${want.type} it became`)
    const personLevel =
      mine.type === "heading" && mine.level !== before.level ? mine : null
    const levelFrom = personLevel ?? (want.type === "heading" ? want : null)
    if (
      entry.type === "heading" &&
      levelFrom?.type === "heading" &&
      (personLevel !== null || other.level !== before.level) &&
      entry.level !== levelFrom.level
    )
      fail(`${entry.id} lost its heading level ${levelFrom.level}`)
  }
  return result.length
}

const CASES = Number(process.env.PAPER_REBASE_CASES ?? 400)
const FIRST = Number(process.env.PAPER_REBASE_FIRST ?? 1)

describe("rebasePending against an independent model", () => {
  it(`keeps every person and server edit across ${CASES} random cases`, () => {
    for (let seed = FIRST; seed < FIRST + CASES; seed += 1) checkCase(seed)
  })
})
