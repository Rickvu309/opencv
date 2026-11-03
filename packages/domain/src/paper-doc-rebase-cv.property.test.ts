import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperDocumentSchema,
  type PaperDocument,
} from "./paper-doc/document.ts"
import { rebasePending } from "./paper-doc/rebase.ts"
import {
  baseTree,
  bulletsOf,
  docWords,
  editSide,
  itemWords,
  rng,
  shortFields,
  toDocument,
  wordBlocks,
  type Aim,
  type Facts,
  type Item,
  type Tree,
} from "../test/cv-rebase-edit.ts"

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
    if (!personChanged && !otherChanged) {
      if (resultV !== undefined && resultV !== baseV) {
        fail(`untouched field ${key} changed`)
      }
      continue
    }
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
  const oursAim: Aim = { bullet: null, field: null }
  const theirAim: Aim = { bullet: null, field: null }
  const oursSteps = 1 + random.below(4)
  const theirSteps = 1 + random.below(4)
  const oursCounter = { word: 1, block: 1 }
  const theirCounter = { word: 1, block: 1 }
  editSide(
    random,
    ours,
    oursCounter,
    facts,
    "p",
    oursAim,
    theirAim,
    Math.ceil(oursSteps / 2)
  )
  editSide(
    random,
    theirs,
    theirCounter,
    facts,
    "t",
    theirAim,
    oursAim,
    Math.ceil(theirSteps / 2)
  )
  editSide(
    random,
    ours,
    oursCounter,
    facts,
    "p",
    oursAim,
    theirAim,
    Math.floor(oursSteps / 2)
  )
  editSide(
    random,
    theirs,
    theirCounter,
    facts,
    "t",
    theirAim,
    oursAim,
    Math.floor(theirSteps / 2)
  )
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
  const ourWords = itemWords(ours)
  const theirWords = itemWords(theirs)
  for (const word of theirWords) {
    if (!baseWords.has(word) && count(word) !== 1) {
      fail(`other word ${word} appears ${count(word)} times`)
    }
  }
  for (const word of resultWords) {
    if (!ourWords.has(word) && !theirWords.has(word)) fail(`invented ${word}`)
  }
  const ids: string[] = []
  const visitIds = (
    nodes: readonly { id: string; children?: readonly unknown[] }[]
  ) => {
    for (const node of nodes) {
      ids.push(node.id)
      if (node.children) visitIds(node.children as never)
    }
  }
  visitIds(rebased.document.blocks as never)
  if (new Set(ids).size !== ids.length) fail("an id is used twice")
  const present = new Set(ids)
  const baseIds = new Set<string>()
  const addIds = (tree: Tree, into: Set<string>) => {
    const walk = (items: Item[]) => {
      for (const item of items) {
        into.add(item.id)
        walk(item.children)
      }
    }
    for (const block of tree.blocks) {
      into.add(block.id)
      if ("children" in block) walk(block.children)
    }
  }
  addIds(base, baseIds)
  const oursIds = new Set<string>()
  addIds(ours, oursIds)
  for (const id of oursIds) {
    if (!baseIds.has(id) && !present.has(id)) {
      fail(`person-added block ${id} is missing`)
    }
  }
  const ourHas = new Set(ourAt.values())
  const theirHas = new Set(theirAt.values())
  for (const [word, id] of baseAt) {
    if (
      !ourAt.has(word) &&
      theirAt.get(word) === id &&
      ourHas.has(id) &&
      count(word) !== 0
    ) {
      fail(`word ${word} the person deleted came back`)
    }
    if (
      !theirAt.has(word) &&
      ourAt.get(word) === id &&
      theirHas.has(id) &&
      count(word) !== 0
    ) {
      fail(`word ${word} the other side deleted came back`)
    }
    if (ourAt.has(word) && theirAt.has(word) && count(word) < 1) {
      fail(`lost shared word ${word}`)
    }
  }
  const orderOf = (tree: Tree) => {
    const out = new Map<string, string[]>()
    for (const { item } of bulletsOf(tree)) {
      out.set(
        item.id,
        item.words.map((word) => word.w)
      )
    }
    return out
  }
  const resultOrder = new Map<string, string[]>()
  const visitOrder = (
    nodes: readonly {
      id: string
      type: string
      content?: { text: string }[]
      children?: readonly unknown[]
    }[]
  ) => {
    for (const node of nodes) {
      if (node.type === "bullet" || node.type === "numbered") {
        resultOrder.set(
          node.id,
          (node.content ?? []).flatMap((run) =>
            run.text.split(/\s+/).filter(Boolean)
          )
        )
      }
      if (node.children) visitOrder(node.children as never)
    }
  }
  visitOrder(rebased.document.blocks as never)
  const inOrder = (whole: readonly string[], part: readonly string[]) => {
    let at = 0
    for (const word of whole) if (word === part[at]) at += 1
    return at === part.length
  }
  for (const side of [orderOf(ours), orderOf(theirs)]) {
    for (const [id, words] of side) {
      const got = resultOrder.get(id)
      if (!got) continue
      const kept = words.filter((word) => got.includes(word))
      if (!inOrder(got, kept)) fail(`order of ${id} breaks a side's order`)
    }
  }
  checkFields(
    fail,
    shortFields(baseDoc),
    shortFields(oursDoc),
    shortFields(theirsDoc),
    shortFields(rebased.document)
  )
}

const nightly = process.env.GITHUB_WORKFLOW === "Full run on main"
const CASES = Number(process.env.PAPER_REBASE_CASES ?? (nightly ? 20_000 : 400))
const FIRST = Number(
  process.env.PAPER_REBASE_FIRST ??
    (nightly ? Math.floor(Date.now() / 86_400_000) : 1)
)

describe("rebasePending on CV shapes", () => {
  it(`keeps CV fields and both sides' words across ${CASES} random cases`, () => {
    for (let seed = FIRST; seed < FIRST + CASES; seed += 1) checkCase(seed)
  })
})
