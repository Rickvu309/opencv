import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperDocumentSchema,
  type PaperDocument,
} from "./paper-doc/document.ts"
import { rebasePending } from "./paper-doc/rebase.ts"

const KINDS = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
] as const

type Kind = (typeof KINDS)[number]
type Word = { w: string; bold: boolean }
type Item = {
  id: string
  type: "bullet" | "numbered"
  words: Word[]
  children: Item[]
}
type Header = {
  name: string
  email: string
  phone: string
  city: string
  linkedin: string
}
type Section = { id: string; type: "section"; kind: Kind; title: string }
type Experience = {
  id: string
  type: "experience"
  role: string
  company: string
  period: string
  location: string
  children: Item[]
}
type Education = {
  id: string
  type: "education"
  school: string
  degree: string
  period: string
  detail: string
  children: Item[]
}
type Skills = { id: string; type: "skills"; label: string; items: string[] }
type Block = Section | Experience | Education | Skills
type Tree = { header: Header; blocks: Block[] }
type Side = "p" | "t"
type Facts = {
  restructured: Set<string>
  joined: string[]
  hosts: Set<string>
  counts: { p: number; t: number }
  edited: Set<string>
  composite: boolean
  splitBySide: Set<string>
}
type Counter = { word: number; block: number }
type Random = {
  next: () => number
  below: (n: number) => number
  pick: <T>(items: readonly T[]) => T
}

function rng(seed: number): Random {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const below = (n: number) => Math.floor(next() * n)
  return { next, below, pick: (items) => items[below(items.length)]! }
}

const bullet = (id: string, words: string[], children: Item[] = []): Item => ({
  id,
  type: "bullet",
  words: words.map((w) => ({ w, bold: false })),
  children,
})

function baseTree(): Tree {
  return {
    header: {
      name: "Ada",
      email: "ada@ex.com",
      phone: "1",
      city: "London",
      linkedin: "ada",
    },
    blocks: [
      { id: "s1", type: "section", kind: "experience", title: "Experience" },
      {
        id: "e1",
        type: "experience",
        role: "Analyst",
        company: "Babbage",
        period: "1842",
        location: "London",
        children: [
          bullet(
            "u1",
            ["alpha", "beta"],
            [bullet("u2", ["gamma"], [bullet("u3", ["epsilon"])])]
          ),
          bullet("u4", ["zeta", "eta"]),
        ],
      },
      { id: "s2", type: "section", kind: "education", title: "Education" },
      {
        id: "d1",
        type: "education",
        school: "School",
        degree: "Maths",
        period: "1835",
        detail: "Notes",
        children: [bullet("u5", ["theta", "iota"])],
      },
      { id: "s3", type: "section", kind: "skills", title: "Skills" },
      {
        id: "k1",
        type: "skills",
        label: "Tools",
        items: ["Figma", "SQL", "C, C++"],
      },
    ],
  }
}

function runs(words: Word[]) {
  return words.flatMap((word, at) => [
    ...(at > 0 ? [{ text: " " }] : []),
    { text: word.w },
  ])
}

function itemNode(item: Item): Record<string, unknown> {
  return {
    id: item.id,
    type: item.type,
    content: runs(item.words),
    children: item.children.map(itemNode),
  }
}

function toDocument(tree: Tree): PaperDocument {
  const block = (node: Block): Record<string, unknown> => {
    if (node.type === "section") {
      return {
        id: node.id,
        type: "section",
        kind: node.kind,
        title: node.title,
      }
    }
    if (node.type === "skills") {
      return {
        id: node.id,
        type: "skills",
        label: node.label,
        items: node.items,
      }
    }
    if (node.type === "experience") {
      return {
        id: node.id,
        type: "experience",
        role: node.role,
        company: node.company,
        period: node.period,
        location: node.location,
        children: node.children.map(itemNode),
      }
    }
    return {
      id: node.id,
      type: "education",
      school: node.school,
      degree: node.degree,
      period: node.period,
      detail: node.detail,
      children: node.children.map(itemNode),
    }
  }
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    header: { id: "header", type: "header", ...tree.header },
    blocks: tree.blocks.map(block),
    clashes: [],
  })
}

function bulletsOf(tree: Tree) {
  const found: { item: Item; list: Item[] }[] = []
  const visit = (list: Item[]) => {
    for (const item of list) {
      found.push({ item, list })
      visit(item.children)
    }
  }
  for (const block of tree.blocks) {
    if (block.type === "experience" || block.type === "education")
      visit(block.children)
  }
  return found
}

function depthOf(list: Item[], item: Item, depth = 1): number {
  for (const candidate of list) {
    if (candidate === item) return depth
    const inner = depthOf(candidate.children, item, depth + 1)
    if (inner) return inner
  }
  return 0
}

function depthIn(tree: Tree, item: Item) {
  for (const block of tree.blocks) {
    if (block.type !== "experience" && block.type !== "education") continue
    const depth = depthOf(block.children, item)
    if (depth) return depth
  }
  return 0
}

function leavesUnsectioned(blocks: Block[]) {
  let seen = false
  for (const block of blocks) {
    if (block.type === "section") seen = true
    else if (!seen) return true
  }
  return false
}

function slotsAfterSection(blocks: Block[]) {
  const slots: number[] = []
  let seen = false
  for (let i = 0; i <= blocks.length; i += 1) {
    if (seen) slots.push(i)
    if (blocks[i]?.type === "section") seen = true
  }
  return slots
}

function noteStructural(facts: Facts, id: string, side: Side) {
  facts.counts[side] += 1
  if (facts.counts[side] > 1 || facts.edited.has(id)) facts.composite = true
  facts.joined.push(id)
}

function markText(facts: Facts, side: Side, id: string) {
  if (facts.hosts.has(id)) facts.composite = true
  facts.edited.add(id)
  if (facts.splitBySide.has(`${side}:${id}`)) facts.composite = true
}

function splitItem(
  facts: Facts,
  side: Side,
  item: Item,
  list: Item[],
  id: string
) {
  if (item.words.length < 2) return false
  facts.splitBySide.add(`${side}:${item.id}`)
  facts.splitBySide.add(`${side}:${id}`)
  facts.restructured.add(item.id)
  noteStructural(facts, item.id, side)
  const cut = 1 + Math.floor(item.words.length / 2 - 0.5)
  const words = item.words.splice(Math.min(cut, item.words.length - 1))
  list.splice(list.indexOf(item) + 1, 0, {
    id,
    type: item.type,
    words,
    children: [],
  })
  return true
}

function joinItem(facts: Facts, side: Side, item: Item, list: Item[]) {
  const at = list.indexOf(item)
  const previous = list[at - 1]
  if (at <= 0 || item.children.length > 0 || previous?.type !== item.type)
    return
  if (facts.hosts.has(item.id) || facts.joined.includes(previous.id)) {
    facts.composite = true
  }
  previous.words.push(...item.words)
  list.splice(at, 1)
  noteStructural(facts, item.id, side)
  facts.hosts.add(previous.id)
}

function wordBlocks(tree: Tree) {
  const map = new Map<string, string>()
  for (const { item } of bulletsOf(tree)) {
    for (const word of item.words) map.set(word.w, item.id)
  }
  return map
}

function editSide(
  random: Random,
  tree: Tree,
  counter: Counter,
  facts: Facts,
  side: Side
) {
  let splitOnce = false
  const steps = 1 + random.below(4)
  const freshWord = () => `${side}${counter.word++}`
  const freshId = () => `${side}${counter.block++}`
  for (let step = 0; step < steps; step += 1) {
    const op = random.below(13)
    if (op === 0) {
      const key = random.pick([
        "name",
        "email",
        "phone",
        "city",
        "linkedin",
      ] as const)
      tree.header[key] = freshWord()
    } else if (op === 1) {
      const sections = tree.blocks.filter((block) => block.type === "section")
      const section = random.pick(sections)
      if (section.type !== "section") continue
      if (random.next() < 0.5) section.title = freshWord()
      else
        section.kind = random.pick(
          KINDS.filter((kind) => kind !== section.kind)
        )
    } else if (op === 2) {
      tree.blocks.splice(random.below(tree.blocks.length + 1), 0, {
        id: freshId(),
        type: "section",
        kind: random.pick(KINDS),
        title: freshWord(),
      })
    } else if (op === 3) {
      const sections = tree.blocks.filter((block) => block.type === "section")
      const section = random.pick(sections)
      const next = tree.blocks.filter((block) => block !== section)
      if (!leavesUnsectioned(next)) tree.blocks = next
    } else if (op === 4) {
      const entries = tree.blocks.filter(
        (block) => block.type === "experience" || block.type === "education"
      )
      if (entries.length === 0) continue
      const entry = random.pick(entries)
      if (entry.type === "experience") {
        const key = random.pick([
          "role",
          "company",
          "period",
          "location",
        ] as const)
        entry[key] = freshWord()
      } else if (entry.type === "education") {
        const key = random.pick([
          "school",
          "degree",
          "period",
          "detail",
        ] as const)
        entry[key] = freshWord()
      }
    } else if (op === 5) {
      const group = tree.blocks.find((block) => block.type === "skills")
      if (!group || group.type !== "skills") continue
      const which = random.below(4)
      if (which === 0) group.items.push(freshWord())
      else if (which === 1 && group.items.length > 0) {
        group.items.splice(random.below(group.items.length), 1)
      } else if (which === 2) group.label = freshWord()
      else {
        const at = group.items.findIndex((item) => item.includes(","))
        if (at < 0) group.items.push(`${freshWord()}, ${freshWord()}`)
        else {
          const parts = group.items[at]!.split(",")
            .map((part) => part.trim())
            .filter(Boolean)
          if (parts.length >= 2) group.items.splice(at, 1, ...parts)
        }
      }
    } else if (op === 6) {
      const entries = tree.blocks.filter((block) => block.type !== "section")
      if (entries.length === 0) continue
      const entry = random.pick(entries)
      const from = tree.blocks.indexOf(entry)
      tree.blocks.splice(from, 1)
      const slots = slotsAfterSection(tree.blocks)
      if (slots.length === 0) tree.blocks.splice(from, 0, entry)
      else tree.blocks.splice(random.pick(slots), 0, entry)
    } else if (op === 7 || op === 8) {
      const all = bulletsOf(tree)
      if (all.length === 0) continue
      const { item } = random.pick(all)
      if (op === 8 && item.words.length === 0) continue
      markText(facts, side, item.id)
      if (op === 7) {
        item.words.splice(random.below(item.words.length + 1), 0, {
          w: freshWord(),
          bold: false,
        })
      } else item.words.splice(random.below(item.words.length), 1)
    } else if (op === 9 && !splitOnce) {
      const all = bulletsOf(tree)
      if (all.length === 0) continue
      const { item, list } = random.pick(all)
      if (splitItem(facts, side, item, list, freshId())) splitOnce = true
    } else if (op === 10) {
      const all = bulletsOf(tree)
      if (all.length === 0) continue
      const { item, list } = random.pick(all)
      joinItem(facts, side, item, list)
    } else if (op === 11) {
      const parents = bulletsOf(tree).filter(
        ({ item }) => depthIn(tree, item) < 3
      )
      if (parents.length > 0 && random.next() < 0.6) {
        random
          .pick(parents)
          .item.children.push(bullet(freshId(), [freshWord()]))
      } else {
        const slots = slotsAfterSection(tree.blocks)
        if (slots.length === 0) continue
        const child = bullet(freshId(), [freshWord()])
        const id = freshId()
        const entry: Block =
          random.next() < 0.5
            ? {
                id,
                type: "experience",
                role: freshWord(),
                company: "Co",
                period: "",
                location: "",
                children: [child],
              }
            : {
                id,
                type: "education",
                school: freshWord(),
                degree: "",
                period: "",
                detail: "",
                children: [child],
              }
        tree.blocks.splice(random.pick(slots), 0, entry)
      }
    } else if (op === 12) {
      const all = bulletsOf(tree)
      if (all.length === 0) continue
      const { item, list } = random.pick(all)
      if (facts.restructured.has(item.id)) facts.composite = true
      list.splice(list.indexOf(item), 1)
    }
  }
}

function itemWords(tree: Tree) {
  const words = new Set<string>()
  for (const { item } of bulletsOf(tree)) {
    for (const word of item.words) words.add(word.w)
  }
  return words
}

function docWords(doc: PaperDocument) {
  const out: string[] = []
  const visit = (
    nodes: readonly {
      content?: { text: string }[]
      children?: readonly unknown[]
    }[]
  ) => {
    for (const node of nodes) {
      for (const run of node.content ?? []) {
        for (const word of run.text.split(/\s+/)) if (word) out.push(word)
      }
      if (node.children) visit(node.children as never)
    }
  }
  visit(doc.blocks as never)
  return out
}

const HEADER_KEYS = ["name", "email", "phone", "city", "linkedin"] as const

function shortFields(doc: PaperDocument) {
  const out = new Map<string, string>()
  if (doc.kind !== "cv") return out
  for (const key of HEADER_KEYS) out.set(`header.${key}`, doc.header[key])
  for (const block of doc.blocks) {
    if (block.type === "section") {
      out.set(`${block.id}.kind`, block.kind)
      out.set(`${block.id}.title`, block.title)
    } else if (block.type === "experience") {
      for (const key of ["role", "company", "period", "location"] as const) {
        out.set(`${block.id}.${key}`, block[key])
      }
    } else if (block.type === "education") {
      for (const key of ["school", "degree", "period", "detail"] as const) {
        out.set(`${block.id}.${key}`, block[key])
      }
    } else if (block.type === "skills") {
      out.set(`${block.id}.label`, block.label)
      out.set(`${block.id}.items`, JSON.stringify(block.items))
    }
  }
  return out
}

function checkFields(
  fail: (what: string) => void,
  base: Map<string, string>,
  ours: Map<string, string>,
  theirs: Map<string, string>,
  result: Map<string, string>
) {
  const keys = new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])
  for (const key of keys) {
    const baseV = base.get(key)
    const ourV = ours.get(key)
    const theirV = theirs.get(key)
    const resultV = result.get(key)
    const personChanged = ourV !== undefined && ourV !== baseV
    const otherChanged = theirV !== undefined && theirV !== baseV
    if (!personChanged && !otherChanged) continue
    if (resultV === undefined) {
      if (personChanged) fail(`person field ${key} is missing`)
      continue
    }
    if (personChanged && !otherChanged && resultV !== ourV) {
      fail(`field ${key} lost the person's value`)
    }
    if (!personChanged && otherChanged && resultV !== theirV) {
      fail(`field ${key} lost the other side's value`)
    }
    if (
      personChanged &&
      otherChanged &&
      resultV !== ourV &&
      resultV !== theirV
    ) {
      fail(`field ${key} blended`)
    }
  }
}

function checkCase(seed: number) {
  const random = rng(seed)
  const base = baseTree()
  const facts: Facts = {
    restructured: new Set(),
    joined: [],
    hosts: new Set(),
    counts: { p: 0, t: 0 },
    edited: new Set(),
    composite: false,
    splitBySide: new Set(),
  }
  const ours = structuredClone(base)
  const theirs = structuredClone(base)
  editSide(random, ours, { word: 1, block: 1 }, facts, "p")
  editSide(random, theirs, { word: 1, block: 1 }, facts, "t")
  const movedOurs = new Set<string>()
  const baseAt = wordBlocks(base)
  const ourAt = wordBlocks(ours)
  const theirAt = wordBlocks(theirs)
  for (const [word, id] of baseAt) {
    const now = ourAt.get(word)
    if (now && now !== id) movedOurs.add(id)
  }
  for (const [word, id] of baseAt) {
    const now = theirAt.get(word)
    if (now && now !== id && movedOurs.has(id)) facts.composite = true
  }
  let baseDoc: PaperDocument
  let oursDoc: PaperDocument
  let theirsDoc: PaperDocument
  try {
    baseDoc = toDocument(base)
    oursDoc = toDocument(ours)
    theirsDoc = toDocument(theirs)
  } catch (error) {
    assert.fail(
      `seed ${seed}: generator ${error instanceof Error ? error.message : String(error)}`
    )
  }
  const rebased = rebasePending({
    base: baseDoc,
    ours: oursDoc,
    theirs: theirsDoc,
  })
  const fail = (what: string) =>
    assert.fail(
      `seed ${seed}: ${what} composite=${facts.composite}\n${JSON.stringify({
        ours,
        theirs,
        result: rebased.document,
      })}`
    )
  if (rebased.failed) fail("the merge fell back to keeping blocks beside")
  const parsed = paperDocumentSchema.safeParse(rebased.document)
  if (!parsed.success) {
    fail(parsed.error.issues.map((issue) => issue.message).join("; "))
  }
  const resultWords = docWords(rebased.document)
  const count = (word: string) =>
    resultWords.filter((item) => item === word).length
  const baseWords = itemWords(base)
  for (const word of itemWords(ours)) {
    if (!baseWords.has(word) && count(word) !== 1) {
      fail(`person word ${word} appears ${count(word)} times`)
    }
  }
  for (const word of baseWords) {
    const seen = count(word)
    if (seen > 1 && !facts.composite)
      fail(`base word ${word} appears ${seen} times`)
  }
  checkFields(
    fail,
    shortFields(baseDoc),
    shortFields(oursDoc),
    shortFields(theirsDoc),
    shortFields(rebased.document)
  )
}

const CASES = Number(process.env.PAPER_REBASE_CASES ?? 200)
const FIRST = Number(process.env.PAPER_REBASE_FIRST ?? 1)

describe("rebasePending on CV shapes", () => {
  it(`keeps CV fields and person words across ${CASES} random cases`, () => {
    for (let seed = FIRST; seed < FIRST + CASES; seed += 1) checkCase(seed)
  })
})
