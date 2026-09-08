import { describe, expect, it } from "vitest"

import {
  ATTACH_FROM_PAPER_FAIL,
  addDocChip,
  addSelectionChip,
  consumeUnpinnedContextChips,
  focusDocIdForTurn,
  hasAttachedDocChip,
  hasMatchingSelectionChip,
  removeContextChip,
  selectionForTurn,
  toggleContextChipPin,
} from "./coach-context-chips.ts"

const DOC_ID = "11111111-1111-7111-8111-111111111111"
const BULLET = {
  text: "Ran weekly problem interviews with 8 classmates; turned themes into a one-page PRD for a campus expense app.",
  sectionId: "experience-0",
}

describe("addSelectionChip", () => {
  it("promotes a selection into an unpinned durable chip", () => {
    const chips = addSelectionChip([], BULLET, "sel-1")
    expect(chips).toEqual([
      {
        id: "sel-1",
        kind: "selection",
        pinned: false,
        label: BULLET.text,
        selection: BULLET,
      },
    ])
  })

  it("does not add a duplicate of the same excerpt", () => {
    const once = addSelectionChip([], BULLET, "sel-1")
    expect(addSelectionChip(once, BULLET, "sel-2")).toEqual(once)
  })

  it("ignores empty selection text", () => {
    expect(addSelectionChip([], { text: "   " })).toEqual([])
  })
})

describe("addDocChip", () => {
  it("attaches the open Paper doc as an unpinned chip", () => {
    const result = addDocChip([], DOC_ID, "PM track CV", "doc-1")
    expect(result).toEqual({
      ok: true,
      chips: [
        {
          id: "doc-1",
          kind: "doc",
          pinned: false,
          label: "PM track CV",
          docId: DOC_ID,
          docName: "PM track CV",
        },
      ],
    })
  })

  it("fails honestly when there is no Paper doc to attach", () => {
    expect(addDocChip([], undefined, "PM track CV")).toEqual({
      ok: false,
      chips: [],
      message: ATTACH_FROM_PAPER_FAIL,
    })
    expect(addDocChip([], "   ", "PM track CV")).toEqual({
      ok: false,
      chips: [],
      message: ATTACH_FROM_PAPER_FAIL,
    })
  })

  it("keeps a single chip when the same doc is attached twice", () => {
    const first = addDocChip([], DOC_ID, "PM track CV", "doc-1")
    expect(first.ok).toBe(true)
    const second = addDocChip(first.chips, DOC_ID, "PM track CV", "doc-2")
    expect(second).toEqual({ ok: true, chips: first.chips })
  })
})

describe("pin, remove, and consume", () => {
  it("toggles pin and drops only unpinned chips after a turn", () => {
    const withSelection = addSelectionChip([], BULLET, "sel-1")
    const attached = addDocChip(withSelection, DOC_ID, "PM track CV", "doc-1")
    expect(attached.ok).toBe(true)
    const pinned = toggleContextChipPin(attached.chips, "sel-1")
    expect(pinned.find((chip) => chip.id === "sel-1")?.pinned).toBe(true)

    const leftover = consumeUnpinnedContextChips(pinned)
    expect(leftover.map((chip) => chip.id)).toEqual(["sel-1"])
    expect(removeContextChip(leftover, "sel-1")).toEqual([])
  })
})

describe("selectionForTurn", () => {
  it("prefers durable chips over the live highlight", () => {
    const chips = addSelectionChip([], BULLET, "sel-1")
    expect(
      selectionForTurn(chips, { text: "other highlight", sectionId: "summary" })
    ).toEqual(BULLET)
  })

  it("falls back to the live selection when no chip is held", () => {
    expect(selectionForTurn([], BULLET)).toEqual(BULLET)
    expect(selectionForTurn([])).toBeUndefined()
  })

  it("joins more than one selection chip for the turn", () => {
    const first = addSelectionChip([], BULLET, "sel-1")
    const chips = addSelectionChip(
      first,
      { text: "Facilitated prioritization workshops using RICE.", sectionId: "experience-0" },
      "sel-2"
    )
    expect(selectionForTurn(chips)?.text).toContain("Ran weekly")
    expect(selectionForTurn(chips)?.text).toContain("Facilitated")
    expect(selectionForTurn(chips)?.sectionId).toBe("experience-0")
  })
})

describe("focusDocIdForTurn", () => {
  it("keeps the open CV when soft-scope or an attached-doc chip is present", () => {
    expect(focusDocIdForTurn(true, [], DOC_ID)).toBe(DOC_ID)
    expect(focusDocIdForTurn(false, [], DOC_ID)).toBeNull()
    const attached = addDocChip([], DOC_ID, "PM track CV", "doc-1")
    expect(attached.ok).toBe(true)
    expect(focusDocIdForTurn(false, attached.chips, DOC_ID)).toBe(DOC_ID)
    expect(hasAttachedDocChip(attached.chips, DOC_ID)).toBe(true)
  })
})

describe("hasMatchingSelectionChip", () => {
  it("detects a chip that already holds this excerpt", () => {
    const chips = addSelectionChip([], BULLET, "sel-1")
    expect(hasMatchingSelectionChip(chips, BULLET)).toBe(true)
    expect(
      hasMatchingSelectionChip(chips, { text: "other", sectionId: "summary" })
    ).toBe(false)
  })
})
