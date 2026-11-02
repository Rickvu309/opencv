import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyPaperEdits,
  effectsMissing,
  paperDocumentSchema,
  paperEditSchema,
  personWorkLost,
  undoCoachEdit,
  undoProblems,
  type PaperDocument,
} from "./paper-doc/index.ts"
import { inverseText, matchIndexes } from "./paper-doc/text-align.ts"

function paper(blocks: unknown[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "cv",
    clashes: [],
    header: {
      id: "header",
      type: "header",
      name: "Ada",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    blocks,
  })
}

const para = (id: string, text: string) => ({
  id,
  type: "paragraph",
  content: [{ text }],
})

const section = { id: "s1", type: "section", kind: "summary", title: "Profile" }

function counter() {
  let n = 0
  return () => `n${++n}`
}

describe("inverseText", () => {
  it("takes the Coach's characters out and keeps the person's inside them", () => {
    assert.equal(
      inverseText(
        "First.",
        "First. Coach adds a sentence.",
        "First. Coach adds QUICK a sentence."
      ),
      "First.QUICK "
    )
  })

  it("puts back what the Coach deleted next to what the person typed", () => {
    assert.equal(
      inverseText("Hello brave world", "Hello world", "Hello world today"),
      "Hello brave world today"
    )
  })

  it("matches a long text without trouble", () => {
    const text = "word ".repeat(600)
    assert.ok(matchIndexes(text, `${text}x`))
  })
})

describe("personWorkLost", () => {
  const base = paper([section, para("p1", "Hello"), para("p2", "World")])

  it("is empty when the merge keeps everything the person typed", () => {
    const live = paper([
      section,
      para("p1", "Hello there"),
      para("p2", "World"),
    ])
    const merged = paper([
      section,
      para("p1", "Hello there!"),
      para("p2", "World"),
    ])
    assert.deepEqual(personWorkLost(base, live, merged), [])
  })

  it("names typing lost inside a block that was rebuilt from older text", () => {
    const live = paper([
      section,
      para("p1", "Hello"),
      para("p2", "World TYPED"),
    ])
    const merged = paper([section, para("p2", "World"), para("p1", "Hello")])
    assert.equal(personWorkLost(base, live, merged).length, 1)
  })

  it("names a block the person added that is gone", () => {
    const live = paper([section, para("p1", "Hello"), para("new", "Mine")])
    const merged = paper([section, para("p1", "Hello")])
    assert.match(personWorkLost(base, live, merged)[0]!, /new/)
  })

  it("names a field the person changed that was put back", () => {
    const withRole = (role: string) =>
      paper([
        section,
        {
          id: "e1",
          type: "experience",
          role,
          company: "C",
          period: "",
          location: "",
          children: [],
        },
      ])
    const problems = personWorkLost(withRole("A"), withRole("B"), withRole("A"))
    assert.match(problems[0]!, /role/)
  })
})

describe("effectsMissing", () => {
  it("flags an op whose effect is not in the merged document", () => {
    const base = paper([section, para("p1", "Hello")])
    const result = applyPaperEdits(
      base,
      base,
      [
        paperEditSchema.parse({
          op: "setText",
          blockId: "p1",
          text: "Hello COACH",
        }),
        paperEditSchema.parse({
          op: "insert",
          after: "p1",
          blocks: [{ type: "paragraph", text: "New" }],
        }),
      ],
      counter()
    )
    assert.deepEqual(effectsMissing(result.effects, result.target), [])
    const dropped = effectsMissing(result.effects, base)
    assert.deepEqual(
      dropped.map((item) => item.op),
      [0, 1]
    )
  })
})

describe("undoCoachEdit", () => {
  it("restores a removed block, moves one back and strips an added one", () => {
    const pre = paper([
      section,
      para("p1", "One"),
      para("p2", "Two"),
      para("p3", "Three"),
    ])
    const edit = applyPaperEdits(
      pre,
      pre,
      [
        paperEditSchema.parse({ op: "remove", blockId: "p2" }),
        paperEditSchema.parse({ op: "move", blockId: "p1", after: "p3" }),
        paperEditSchema.parse({
          op: "insert",
          after: "p3",
          blocks: [{ type: "paragraph", text: "Added" }],
        }),
      ],
      counter()
    )
    const post = edit.target
    const live = paper([
      section,
      para("p3", "Three typed"),
      para("n1", "Added"),
      para("p1", "One typed"),
    ])
    const plan = undoCoachEdit(pre, post, live)
    assert.ok(plan.ok, plan.ok ? "" : plan.reason)
    assert.deepEqual(
      plan.target.blocks.map((block) => block.id),
      ["s1", "p1", "p2", "p3"]
    )
    assert.deepEqual([...plan.moved], ["p1"])
    assert.deepEqual(undoProblems(pre, post, live, plan.target), [])
  })

  it("refuses when the person moved the block since", () => {
    const pre = paper([
      section,
      para("p1", "One"),
      para("p2", "Two"),
      para("p3", "Three"),
    ])
    const post = applyPaperEdits(
      pre,
      pre,
      [paperEditSchema.parse({ op: "move", blockId: "p1", after: "p3" })],
      counter()
    ).target
    const live = paper([
      section,
      para("p2", "Two"),
      para("p1", "One"),
      para("p3", "Three"),
    ])
    assert.equal(undoCoachEdit(pre, post, live).ok, false)
  })

  it("flags an undo result that drops the person's text", () => {
    const pre = paper([section, para("p1", "One")])
    const post = paper([section, para("p1", "One Coach")])
    const live = paper([section, para("p1", "One Coach typed")])
    const bad = paper([section, para("p1", "One")])
    assert.ok(undoProblems(pre, post, live, bad).length > 0)
  })
})
