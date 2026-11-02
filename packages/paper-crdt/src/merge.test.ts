import { plainTextOfRuns, type PaperDocument } from "@workspace/domain"
import * as Y from "yjs"
import { describe, expect, it } from "vitest"

import { revertOrigin, writeDocument } from "./index.js"
import { cv, outline, para, room, snapshot } from "./test/room.js"

const COACH = "coach:1"

function revert(
  live: Y.Doc,
  history: Parameters<typeof revertOrigin>[0],
  origin = COACH
) {
  const update = revertOrigin(history, origin)
  if (!update) throw new Error("expected a revert update")
  Y.applyUpdate(live, update, `revert:${origin}`)
}

function contentOf(document: PaperDocument, id: string) {
  const block = document.blocks.find((candidate) => candidate.id === id)
  return block && "content" in block ? block.content : undefined
}

describe("a Coach write matches blocks by id", () => {
  it("keeps the person's typing when the Coach deletes the block before", () => {
    const base = cv([para("p1", "first line"), para("p2", "second line")])
    const { live, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(
        live,
        cv([para("p1", "first line"), para("p2", "second line PERSON")]),
        "person"
      ),
      "person"
    )
    merge(
      writeDocument(atRead, cv([para("p2", "Second line, tightened")]), COACH),
      COACH
    )
    const merged = outline(snapshot(live))
    expect(merged.map(([id]) => id)).toEqual(["p2"])
    expect(merged[0]?.[1]).toContain(" PERSON")
    expect(merged[0]?.[1].replace(" PERSON", "")).toBe("Second line, tightened")
  })

  it("keeps the person's typing when the Coach inserts a block before", () => {
    const base = cv([para("p1", "alpha"), para("p2", "beta")])
    const { live, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(
        live,
        cv([para("p1", "alpha PERSON"), para("p2", "beta")]),
        "person"
      ),
      "person"
    )
    merge(
      writeDocument(
        atRead,
        cv([para("n1", "new intro"), para("p1", "Alpha"), para("p2", "beta")]),
        COACH
      ),
      COACH
    )
    expect(outline(snapshot(live))).toEqual([
      ["n1", "new intro"],
      ["p1", "Alpha PERSON"],
      ["p2", "beta"],
    ])
  })

  it("keeps the person's typing when the Coach reorders blocks", () => {
    const base = cv([para("p1", "one"), para("p2", "two")])
    const { live, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(
        live,
        cv([para("p1", "one plus person words"), para("p2", "two")]),
        "person"
      ),
      "person"
    )
    merge(
      writeDocument(atRead, cv([para("p2", "two"), para("p1", "one")]), COACH),
      COACH
    )
    const merged = outline(snapshot(live))
    expect(merged.map(([id]) => id)).toEqual(["p2", "p1"])
    expect(merged[0]?.[1]).toBe("two")
  })

  it("reconciles nested list items by id", () => {
    const item = (id: string, content: string, children: unknown[] = []) => ({
      id,
      type: "bullet",
      content,
      children,
    })
    const base = cv([
      item("a", "alpha", [item("a1", "child one"), item("a2", "child two")]),
    ])
    const { live, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(
        live,
        cv([
          item("a", "alpha", [
            item("a1", "child one"),
            item("a2", "child two PERSON"),
          ]),
        ]),
        "person"
      ),
      "person"
    )
    merge(
      writeDocument(
        atRead,
        cv([item("a", "alpha", [item("a2", "Child two")])]),
        COACH
      ),
      COACH
    )
    const [head] = snapshot(live).blocks
    const kids = head?.type === "bullet" ? head.children : []
    expect(kids.map((kid) => plainTextOfRuns(kid.content))).toEqual([
      "Child two PERSON",
    ])
  })

  it("moves a block by deleting and inserting it", () => {
    const base = cv([para("a", "A"), para("b", "B"), para("c", "C")])
    const { live, merge, fork } = room(base)
    merge(
      writeDocument(
        fork(),
        cv([para("c", "C"), para("a", "A"), para("b", "B")]),
        COACH
      ),
      COACH
    )
    expect(outline(snapshot(live)).map(([id]) => id)).toEqual(["c", "a", "b"])
  })
})

describe("a Coach write edits characters, not whole text", () => {
  it("keeps the person's deletion and bold inside the Coach's span", () => {
    const base = cv([para("p1", "alpha beta gamma delta")])
    const { live, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(live, cv([para("p1", "alpha beta delta")]), "person"),
      "person"
    )
    merge(
      writeDocument(
        live,
        cv([
          para("p1", [
            { text: "alpha " },
            { text: "beta", bold: true },
            { text: " delta" },
          ]),
        ]),
        "person"
      ),
      "person"
    )
    merge(
      writeDocument(atRead, cv([para("p1", "ALPHA beta gamma DELTA")]), COACH),
      COACH
    )
    expect(contentOf(snapshot(live), "p1")).toEqual([
      { text: "ALPHA " },
      { text: "beta", bold: true },
      { text: " DELTA" },
    ])
  })

  it("writes several small edits for far apart changes", () => {
    const base = cv([para("p1", "alpha beta gamma delta")])
    const { live } = room(base)
    const update = writeDocument(
      live,
      cv([para("p1", "ALPHA beta gamma DELTA")]),
      COACH
    )
    expect(update?.length).toBeLessThan(70)
    expect(outline(snapshot(live))).toEqual([["p1", "ALPHA beta gamma DELTA"]])
  })

  it("adds and removes marks on a range", () => {
    const base = cv([
      para("p1", [{ text: "keep " }, { text: "bold", bold: true }]),
    ])
    const { live } = room(base)
    writeDocument(
      live,
      cv([
        para("p1", [
          { text: "keep", bold: true },
          { text: " bold link", href: "https://example.com/x" },
        ]),
      ]),
      COACH
    )
    expect(contentOf(snapshot(live), "p1")).toEqual([
      { text: "keep", bold: true },
      { text: " bold link", href: "https://example.com/x" },
    ])
  })
})

describe("reverting a Coach row", () => {
  it("brings back the person's typing in a block the Coach deleted first", () => {
    const base = cv([para("p1", "one"), para("p2", "two")])
    const { live, history, merge, fork } = room(base)
    const person = fork()
    const personTyping = writeDocument(
      person,
      cv([para("p1", "one plus person words"), para("p2", "two")]),
      "person"
    )
    merge(writeDocument(fork(), cv([para("p2", "two")]), COACH), COACH)
    merge(personTyping, "person")
    expect(outline(snapshot(live))).toEqual([["p2", "two"]])
    revert(live, history)
    expect(outline(snapshot(live))).toEqual([
      ["p1", "one plus person words"],
      ["p2", "two"],
    ])
  })

  it("does not bring back text the person deleted before the Coach deleted the block", () => {
    const base = cv([para("p1", "one two"), para("p2", "x")])
    const { live, history, merge, fork } = room(base)
    const atRead = fork()
    merge(
      writeDocument(live, cv([para("p1", "one"), para("p2", "x")]), "person"),
      "person"
    )
    merge(writeDocument(atRead, cv([para("p2", "x")]), COACH), COACH)
    revert(live, history)
    expect(outline(snapshot(live))).toEqual([
      ["p1", "one"],
      ["p2", "x"],
    ])
  })

  it("is safe to run twice once the first revert is in history", () => {
    const base = cv([para("p1", "old words")])
    const { live, history, merge } = room(base)
    merge(writeDocument(live, cv([para("p1", "new words")]), COACH), COACH)
    const update = revertOrigin(history, COACH)
    if (!update) throw new Error("expected a revert update")
    Y.applyUpdate(live, update, `revert:${COACH}`)
    history.push({ update, origin: `revert:${COACH}` })
    expect(revertOrigin(history, COACH)).toBeNull()
    expect(outline(snapshot(live))).toEqual([["p1", "old words"]])
  })
})
