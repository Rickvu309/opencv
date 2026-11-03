import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperDocumentSchema,
  type PaperDocument,
} from "./paper-doc/document.ts"
import { rebasePending } from "./paper-doc/rebase.ts"

function expect(value: unknown) {
  return {
    toEqual: (wanted: unknown) => assert.deepEqual(value, wanted),
    toBeNull: () => assert.equal(value, null),
    toHaveLength: (n: number) => assert.equal((value as unknown[]).length, n),
    toContainEqual: (wanted: unknown) =>
      assert.ok(
        (value as unknown[]).some((item) => {
          try {
            assert.deepEqual(item, wanted)
            return true
          } catch {
            return false
          }
        })
      ),
    not: { toBeNull: () => assert.notEqual(value, null) },
  }
}

type Spec = [string, string, Spec[]?, string?]

function item(spec: Spec): Record<string, unknown> {
  const [id, text, kids, type] = spec
  const kind = type ?? "paragraph"
  return {
    id,
    type: kind,
    ...(kind === "heading" ? { level: 2 } : {}),
    content: [{ text }],
    ...(kind === "bullet" || kind === "numbered"
      ? { children: (kids ?? []).map(item) }
      : {}),
  }
}

function letter(...specs: Spec[]): PaperDocument {
  return paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks: specs.map(item),
    clashes: [],
  })
}

function texts(doc: PaperDocument): string[] {
  const out: string[] = []
  const visit = (nodes: readonly Record<string, unknown>[]) => {
    for (const node of nodes) {
      const runs = (node.content ?? []) as { text: string }[]
      out.push(`${String(node.id)}:${runs.map((run) => run.text).join("")}`)
      visit((node.children ?? []) as Record<string, unknown>[])
    }
  }
  visit(doc.blocks as never)
  return out
}

function rebase(
  base: PaperDocument,
  ours: PaperDocument,
  theirs: PaperDocument
) {
  return rebasePending({ base, ours, theirs }).document
}

function runsOf(doc: PaperDocument, id: string) {
  const found = (function visit(nodes: Record<string, unknown>[]): unknown {
    for (const node of nodes) {
      if (node.id === id) return node.content
      const inner = visit((node.children ?? []) as Record<string, unknown>[])
      if (inner) return inner
    }
    return undefined
  })(doc.blocks as never)
  return found as { text: string; bold?: boolean }[]
}

describe("rebasePending", () => {
  it("merges both sides' words once", () => {
    const base = letter(["a", "hello world"])
    const ours = letter(["a", "hello brave world"])
    const theirs = letter(["a", "hello world today"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "a:hello brave world today",
    ])
  })

  it("keeps an identical change once", () => {
    const base = letter(["a", "hello"])
    const both = letter(["a", "hello there"])
    expect(texts(rebase(base, both, both))).toEqual(["a:hello there"])
  })

  it("keeps two different insertions into one gap whole, theirs first", () => {
    const base = letter(["a", "I write today."])
    const ours = letter(["a", "I write today. I hope to meet the founders."])
    const theirs = letter(["a", "I write today. I want to join the team."])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "a:I write today. I want to join the team. I hope to meet the founders.",
    ])
  })

  it("keeps an echo of the person's own insertion once", () => {
    const base = letter(["a", "one four"])
    const ours = letter(["a", "one two three four"])
    const theirs = letter(["a", "one two four"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["a:one two three four"])
  })

  it("merges a Coach change to a paragraph the person joined into the previous one (review 5 H3)", () => {
    const base = letter(["p1", "alpha one"], ["p2", "beta two"], ["p3", "end"])
    const ours = letter(["p1", "alpha one beta two"], ["p3", "end"])
    const theirs = letter(
      ["p1", "alpha one"],
      ["p2", "beta two COACH"],
      ["p3", "end"]
    )
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "p1:alpha one beta two COACH",
      "p3:end",
    ])
  })

  it("follows a Backspace join that glues the words together", () => {
    const base = letter(["p1", "alpha one"], ["p2", "beta two"], ["p3", "end"])
    const ours = letter(["p1", "alpha onebeta two"], ["p3", "end"])
    const theirs = letter(
      ["p1", "alpha one"],
      ["p2", "beta two COACH"],
      ["p3", "end"]
    )
    assert.deepEqual(texts(rebase(base, ours, theirs)), [
      "p1:alpha one beta two COACH",
      "p3:end",
    ])
  })

  it("merges the person's typing into a paragraph the Coach merged away (probe A)", () => {
    const base = letter(["p1", "alpha one"], ["p2", "beta two"], ["p3", "end"])
    const ours = letter(
      ["p1", "alpha one"],
      ["p2", "beta two typed"],
      ["p3", "end"]
    )
    const theirs = letter(["p1", "alpha one beta two"], ["p3", "end"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "p1:alpha one beta two typed",
      "p3:end",
    ])
  })

  it("follows a split: the Coach change inside the split-off tail lands in the new block", () => {
    const base = letter(["p1", "alpha one beta two"])
    const ours = letter(["p1", "alpha one"], ["s1", "beta two"])
    const theirs = letter(["p1", "alpha one beta COACH two"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "p1:alpha one",
      "s1:beta COACH two",
    ])
  })

  it("follows another tab's split: typing in the old block lands in the right half", () => {
    const base = letter(["p1", "alpha one beta two"])
    const ours = letter(["p1", "typed alpha one beta two"])
    const theirs = letter(["p1", "alpha one"], ["s1", "beta two"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "p1:typed alpha one",
      "s1:beta two",
    ])
  })

  for (const [from, to] of [
    ["bullet", "paragraph"],
    ["paragraph", "bullet"],
    ["numbered", "paragraph"],
    ["bullet", "heading"],
  ] as const) {
    it(`merges a ${from} turned into a ${to} on one side with typing on the other`, () => {
      const build = (type: string, text: string, kids: Spec[] = []) =>
        letter(
          [
            "x",
            text,
            type === "paragraph" || type === "heading" ? undefined : kids,
            type,
          ],
          ["z", "end"]
        )
      const base = build(
        from,
        "item",
        from === "bullet" || from === "numbered"
          ? [["k", "kid", undefined, "bullet"]]
          : []
      )
      const lifted: Spec[] =
        from === "bullet" || from === "numbered"
          ? [["k", "kid", undefined, "bullet"]]
          : []
      const ours = letter(["x", "item", undefined, to], ...lifted, ["z", "end"])
      const theirs = build(
        from,
        "item COACH",
        from === "bullet" || from === "numbered"
          ? [["k", "kid", undefined, "bullet"]]
          : []
      )
      const merged = rebase(base, ours, theirs)
      assert.ok(texts(merged).includes("x:item COACH"))
      assert.equal((merged.blocks[0] as unknown as { type: string }).type, to)
      if (from === "bullet" || from === "numbered") {
        assert.ok(texts(merged).includes("k:kid"))
      }
    })
  }

  it("lifts the children of a list item the person turned into a paragraph", () => {
    const base = letter([
      "x",
      "item",
      [["k", "kid", undefined, "bullet"]],
      "bullet",
    ])
    const ours = letter(["x", "item typed"], ["k", "kid"])
    const merged = rebase(base, ours, base)
    expect(texts(merged)).toEqual(["x:item typed", "k:kid"])
  })

  it("puts a block both sides moved into each other at the server's place, not at the end", () => {
    const base = letter(
      ["a", "one", [], "bullet"],
      ["b", "two", [], "bullet"],
      ["c", "three"]
    )
    const ours = letter(
      ["b", "two", [["a", "one", undefined, "bullet"]], "bullet"],
      ["c", "three"]
    )
    const theirs = letter(
      ["a", "one", [["b", "two", undefined, "bullet"]], "bullet"],
      ["c", "three"]
    )
    const merged = rebase(base, ours, theirs)
    expect(texts(merged).sort()).toEqual(["a:one", "b:two", "c:three"])
    assert.notDeepEqual(
      merged.blocks.map((block) => block.id),
      ["c", "a", "b"]
    )
  })

  it("unions the text when both sides added the same id", () => {
    const empty = letter(["z", "end"])
    const ours = letter(["z", "end"], ["n", "restored words"])
    const theirs = letter(["z", "end"], ["n", "restored words"])
    expect(texts(rebase(empty, ours, theirs))).toEqual([
      "z:end",
      "n:restored words",
    ])
  })

  it("merges a restore and a Coach undo that both added the block with different continuations", () => {
    const base = letter(["z", "end"])
    const ours = letter(["z", "end"], ["n", "typed beta two"])
    const theirs = letter(["z", "end"], ["n", "beta two coach"])
    assert.deepEqual(texts(rebase(base, ours, theirs)), [
      "z:end",
      "n:typed beta two coach",
    ])
  })

  it("never splits a word the person typed inside (review 3 H4)", () => {
    const base = letter(["a", "w1x alpha one"])
    const ours = letter(["a", "w2x"])
    const theirs = letter(["a", "w1x alpha one c3x"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["a:w2x c3x"])
  })

  it("keeps a mid-word edit whole next to an appended word", () => {
    const base = letter(["a", "walk"])
    const ours = letter(["a", "walking"])
    const theirs = letter(["a", "walk c3x"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["a:walking c3x"])
  })

  it("keeps the person's replacement and the Coach's replacement of one word", () => {
    const base = letter(["a", "one two three"])
    const ours = letter(["a", "one 2 three"])
    const theirs = letter(["a", "one II three"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["a:one II 2 three"])
  })

  it("drops a word either side deleted", () => {
    const base = letter(["a", "one two three four"])
    const ours = letter(["a", "one three four"])
    const theirs = letter(["a", "one two three"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["a:one three"])
  })

  it("keeps the person's bold on a word the Coach did not touch", () => {
    const base = letter(["a", "one two"])
    const ours = paperDocumentSchema.parse({
      version: 3,
      kind: "letter",
      blocks: [
        {
          id: "a",
          type: "paragraph",
          content: [{ text: "one " }, { text: "two", bold: true }],
        },
      ],
      clashes: [],
    })
    const theirs = letter(["a", "one two three"])
    expect(runsOf(rebase(base, ours, theirs), "a")).toEqual([
      { text: "one " },
      { text: "two", bold: true },
      { text: " three" },
    ])
  })

  it("puts back a block the Coach removed after the person typed in it", () => {
    const base = letter(["a", "one"], ["b", "two"], ["c", "three"])
    const ours = letter(["a", "one"], ["b", "two typed"], ["c", "three"])
    const theirs = letter(["a", "one"], ["c", "three"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "a:one",
      "b:two typed",
      "c:three",
    ])
  })

  it("lets the Coach's removal stand when the person did not touch the block", () => {
    const base = letter(["a", "one"], ["b", "two"])
    const theirs = letter(["a", "one"])
    expect(texts(rebase(base, base, theirs))).toEqual(["a:one"])
  })

  it("restores a removed parent around the person's nested bullet", () => {
    const base = letter(
      ["p", "parent", [["k", "kid", undefined, "bullet"]], "bullet"],
      ["z", "end"]
    )
    const ours = letter(
      ["p", "parent", [["k", "kid typed", undefined, "bullet"]], "bullet"],
      ["z", "end"]
    )
    const theirs = letter(["z", "end"])
    const merged = rebase(base, ours, theirs)
    expect(texts(merged)).toEqual(["p:parent", "k:kid typed", "z:end"])
    expect(
      (merged.blocks[0] as unknown as { children: unknown[] }).children
    ).toHaveLength(1)
  })

  it("keeps a person-added block after its previous surviving sibling", () => {
    const base = letter(["a", "one"], ["b", "two"])
    const ours = letter(["a", "one"], ["n", "new"], ["b", "two"])
    const theirs = letter(["b", "two"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["n:new", "b:two"])
  })

  it("keeps the Coach's version of a block the person deleted", () => {
    const base = letter(["a", "one"], ["b", "two"])
    const ours = letter(["a", "one"])
    const theirs = letter(["a", "one"], ["b", "two coach"])
    expect(texts(rebase(base, ours, theirs))).toEqual(["a:one", "b:two coach"])
  })

  it("deletes a block the person deleted when the Coach left it alone", () => {
    const base = letter(["a", "one"], ["b", "two"])
    const ours = letter(["a", "one"])
    expect(texts(rebase(base, ours, base))).toEqual(["a:one"])
  })

  it("takes the person's position when only the person moved a block", () => {
    const base = letter(["a", "one"], ["b", "two"], ["c", "three"])
    const ours = letter(["b", "two"], ["c", "three"], ["a", "one"])
    const theirs = letter(
      ["a", "one"],
      ["b", "two"],
      ["c", "three"],
      ["d", "x"]
    )
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "b:two",
      "c:three",
      "a:one",
      "d:x",
    ])
  })

  it("takes the server's position when both moved the block", () => {
    const base = letter(["a", "one"], ["b", "two"], ["c", "three"])
    const ours = letter(["b", "two"], ["c", "three"], ["a", "one"])
    const theirs = letter(["b", "two"], ["a", "one"], ["c", "three"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "b:two",
      "a:one",
      "c:three",
    ])
  })

  it("keeps the Coach's text on a block the person moved", () => {
    const base = letter(["a", "one"], ["b", "two"], ["c", "three"])
    const ours = letter(["b", "two"], ["a", "one"], ["c", "three"])
    const theirs = letter(["a", "one COACH"], ["b", "two"], ["c", "three"])
    expect(texts(rebase(base, ours, theirs))).toEqual([
      "b:two",
      "a:one COACH",
      "c:three",
    ])
  })

  it("re-homes a child the Coach moved when the person deleted its old parent (review 3 H3)", () => {
    const base = letter(
      ["l1", "list", undefined, "bullet"],
      ["l2", "child"],
      ["p1", "p"]
    )
    const ours = letter(["l2", "child w2x w3x"], ["p1", "p w4x"])
    const theirs = letter(
      ["l1", "list", [["l2", "child", undefined, "bullet"]], "bullet"],
      ["p1", "p"]
    )
    const merged = rebase(base, ours, theirs)
    expect(texts(merged)).toEqual(["l2:child w2x w3x", "p1:p w4x"])
  })

  it("keeps the person's version beside the live one when the block is too long to merge", () => {
    const words = (tag: string) =>
      Array.from({ length: 2100 }, (_, n) => `${tag}${n}`).join(" ")
    const base = letter(["a", words("b")])
    const ours = letter(["a", words("o")])
    const theirs = letter(["a", words("t")])
    const merged = rebase(base, ours, theirs)
    expect(merged.blocks).toHaveLength(2)
    assert.ok(texts(merged)[0]!.startsWith("a:t0 "))
    assert.ok(texts(merged)[1]!.startsWith("a-p1:o0 "))
  })

  it("keeps both versions when two blocks end with a Coach-removed neighbour", () => {
    const base = letter(["a", "one"], ["b", "two"], ["c", "three"])
    const ours = letter(["c", "three"], ["a", "one"], ["b", "two typed"])
    const theirs = letter(["a", "one"], ["c", "three"])
    expect(texts(rebase(base, ours, theirs)).sort()).toEqual([
      "a:one",
      "b:two typed",
      "c:three",
    ])
  })
})
