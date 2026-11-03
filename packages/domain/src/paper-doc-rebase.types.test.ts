import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperDocumentSchema,
  type PaperDocument,
} from "./paper-doc/document.ts"
import { rebasePending } from "./paper-doc/rebase.ts"

type Raw = Record<string, unknown>

const para = (id: string, text: string): Raw => ({
  id,
  type: "paragraph",
  content: [{ text }],
})

const heading = (id: string, text: string, level: 2 | 3): Raw => ({
  id,
  type: "heading",
  level,
  content: [{ text }],
})

const list = (
  id: string,
  text: string,
  type: "bullet" | "numbered",
  children: Raw[] = []
): Raw => ({ id, type, content: text ? [{ text }] : [], children })

function letter(...blocks: Raw[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks,
    clashes: [],
  })
}

type Row = { id: string; type: string; level?: number; text: string }

function rows(doc: PaperDocument): Row[] {
  const out: Row[] = []
  const visit = (nodes: readonly Raw[]) => {
    for (const node of nodes) {
      const runs = (node.content ?? []) as { text: string }[]
      out.push({
        id: String(node.id),
        type: String(node.type),
        ...(node.level === undefined ? {} : { level: Number(node.level) }),
        text: runs.map((run) => run.text).join(""),
      })
      visit((node.children ?? []) as Raw[])
    }
  }
  visit(doc.blocks as never)
  return out
}

function wordCount(doc: PaperDocument, word: string) {
  return rows(doc)
    .flatMap((row) => row.text.split(/\s+/))
    .filter((w) => w === word).length
}

function rebase(
  base: PaperDocument,
  ours: PaperDocument,
  theirs: PaperDocument
) {
  const result = rebasePending({ base, ours, theirs })
  assert.equal(paperDocumentSchema.safeParse(result.document).success, true)
  return result
}

describe("rebasePending with type and level changes (review 7 H1)", () => {
  it("keeps the person's move and typing when another tab makes the heading a paragraph and the person changes its level", () => {
    const base = letter(
      heading("h", "Dear team", 2),
      para("q", "one two"),
      para("r", "three")
    )
    const ours = letter(
      heading("h", "Dear team", 3),
      para("r", "three"),
      para("q", "one two typed")
    )
    const theirs = letter(
      para("h", "Dear team"),
      para("q", "one two"),
      para("r", "three")
    )
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(rows(result.document), [
      { id: "h", type: "paragraph", text: "Dear team" },
      { id: "r", type: "paragraph", text: "three" },
      { id: "q", type: "paragraph", text: "one two typed" },
    ])
  })

  it("merges a person's type change against another tab's level change without doubling (two-tab api shape)", () => {
    const base = letter(
      heading("h1", "Dear team", 2),
      para("p1", "alpha one"),
      para("p2", "beta two")
    )
    const ours = letter(
      para("h1", "Dear team"),
      para("p1", "alpha one"),
      para("p2", "beta two MINE")
    )
    const theirs = letter(
      heading("h1", "Dear team", 3),
      para("p1", "alpha one"),
      para("p2", "beta two")
    )
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(rows(result.document), [
      { id: "h1", type: "paragraph", text: "Dear team" },
      { id: "p1", type: "paragraph", text: "alpha one" },
      { id: "p2", type: "paragraph", text: "beta two MINE" },
    ])
    for (const word of ["Dear", "beta", "MINE"]) {
      assert.equal(wordCount(result.document, word), 1)
    }
  })

  it("takes the person's bullet when another tab made the paragraph a heading (fuzz seed 1046)", () => {
    const base = letter(para("k1", "b1"), para("k3", "b8"))
    const ours = letter(para("k1", "b1"), list("k3", "b8", "bullet"))
    const theirs = letter(para("k1", "b1"), heading("k3", "b8", 3))
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(rows(result.document), [
      { id: "k1", type: "paragraph", text: "b1" },
      { id: "k3", type: "bullet", text: "b8" },
    ])
  })

  it("takes the other tab's numbered list over the person's heading level (fuzz seeds 1943 and 11810)", () => {
    const base = letter(para("k1", "b1"), heading("k4", "b11 b12", 2))
    const ours = letter(para("k1", "b1"), heading("k4", "b11 b12", 3))
    const theirs = letter(para("k1", "b1"), list("k4", "b11 b12", "numbered"))
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(rows(result.document), [
      { id: "k1", type: "paragraph", text: "b1" },
      { id: "k4", type: "numbered", text: "b11 b12" },
    ])
  })

  it("takes the other tab's paragraph over the person's heading level (fuzz seed 5201)", () => {
    const base = letter(heading("k6", "b18 b19", 3), para("k7", "b22"))
    const ours = letter(heading("k6", "b18 b19", 2), para("k7", "b22"))
    const theirs = letter(para("k6", "b18 b19"), para("k7", "b22"))
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(rows(result.document), [
      { id: "k6", type: "paragraph", text: "b18 b19" },
      { id: "k7", type: "paragraph", text: "b22" },
    ])
  })

  it("keeps the person's heading level when the other tab left the type alone and changed the text", () => {
    const base = letter(heading("k6", "b18 b19", 2))
    const ours = letter(heading("k6", "b18 b19", 3))
    const theirs = letter(heading("k6", "b18 b19 t1", 2))
    const result = rebase(base, ours, theirs)
    assert.deepEqual(rows(result.document), [
      { id: "k6", type: "heading", level: 3, text: "b18 b19 t1" },
    ])
  })

  it("lifts children once when the person turns a parent into a heading and the other tab makes it numbered", () => {
    const base = letter(
      list("l1", "item", "bullet", [list("l2", "kid", "bullet")])
    )
    const ours = letter(heading("l1", "item", 2), list("l2", "kid", "bullet"))
    const theirs = letter(
      list("l1", "item", "numbered", [list("l2", "kid", "bullet")])
    )
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(rows(result.document), [
      { id: "l1", type: "heading", level: 2, text: "item" },
      { id: "l2", type: "bullet", text: "kid" },
    ])
  })

  it("copies only the typed blocks when two writers retype one block (fuzz seed 455)", () => {
    const base = letter(
      heading("k2", "b5 b9", 2),
      list("k5", "b10 b11", "bullet", [
        list("k3", "b14", "bullet"),
        list("k4", "b15", "numbered"),
      ]),
      heading("k6", "b16 b18", 2),
      para("k7", "b19")
    )
    const ours = letter(
      heading("k2", "b5 p20", 2),
      list("k5", "b10 b11", "bullet", [
        list("k3", "", "bullet"),
        list("k4", "b15", "numbered"),
      ]),
      heading("k6", "b16 b18 p21", 2),
      list("k7", "b19", "numbered")
    )
    const theirs = letter(
      heading("k2", "b5 b9", 2),
      list("k5", "b10 t22", "bullet", [
        list("k3", "b14", "bullet"),
        list("k4", "b15", "numbered"),
      ]),
      heading("k6", "b16 b18", 2),
      heading("k7", "b19", 3)
    )
    const result = rebase(base, ours, theirs)
    assert.equal(result.failed, false)
    assert.deepEqual(
      rows(result.document).map((row) => `${row.id}:${row.type}:${row.text}`),
      [
        "k2:heading:b5 p20",
        "k5:bullet:b10 t22",
        "k3:bullet:",
        "k4:numbered:b15",
        "k6:heading:b16 b18 p21",
        "k7:numbered:b19",
      ]
    )
  })
})

describe("rebasePending when the merge fails", () => {
  const failing = () => {
    throw new Error("merge refused")
  }
  const base = letter(
    para("a", "alpha"),
    para("b", "beta"),
    para("c", "gamma"),
    para("d", "delta"),
    para("e", "epsilon")
  )
  const ours = letter(
    para("c", "gamma"),
    para("a", "alpha"),
    para("b", "beta MINE"),
    para("e", "epsilon")
  )
  const theirs = letter(
    para("a", "alpha"),
    para("b", "beta COACH"),
    para("c", "gamma"),
    para("d", "delta"),
    para("e", "epsilon THEIRS")
  )

  it("reports failed, keeps the person's move and deletion, and copies only the block whose words are missing right after it", () => {
    const result = rebasePending({ base, ours, theirs }, failing)
    assert.equal(result.failed, true)
    assert.deepEqual(
      rows(result.document).map((row) => `${row.id}:${row.text}`),
      [
        "c:gamma",
        "a:alpha",
        "b:beta COACH",
        "b-p1:beta MINE",
        "e:epsilon THEIRS",
      ]
    )
  })

  it("keeps every word of both sides beside their originals when the in-place copy fails too", () => {
    const result = rebasePending({ base, ours, theirs }, failing, failing)
    assert.equal(result.failed, true)
    assert.deepEqual(
      rows(result.document).map((row) => `${row.id}:${row.text}`),
      [
        "a:alpha",
        "b:beta COACH",
        "b-p1:beta MINE",
        "c:gamma",
        "d:delta",
        "e:epsilon THEIRS",
      ]
    )
  })

  it("throws instead of writing the person's version over the reply when nothing can be built", () => {
    const broken = {
      ...theirs,
      blocks: [{ id: "a", type: "paragraph", content: [{ text: 5 }] }],
    } as unknown as PaperDocument
    assert.throws(() =>
      rebasePending({ base, ours, theirs: broken }, failing, failing)
    )
  })
})
