import { describe, expect, it } from "vitest"
import type { ApplyCard } from "@workspace/domain"

import {
  boardAnnouncements,
  boardItems,
  settleBoardMove,
} from "@/features/apply/apply-board-move.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"

const cards = sampleApplyCards() as ApplyCard[]
const byTitle = (title: string) => cards.find((c) => c.title === title)!
const items = boardItems(cards)

describe("settleBoardMove", () => {
  it("puts a card dropped on an empty Stage at the end of that Stage", () => {
    const moved = items.map((item) =>
      item.id === byTitle("Business analyst intern").id
        ? { ...item, column: "live" as const }
        : item
    )
    expect(
      settleBoardMove(moved, byTitle("Business analyst intern").id, "live")
    ).toEqual({ stage: "live", beforeCardId: null })
  })

  it("takes the slot of the card it is dropped on, moving up", () => {
    expect(
      settleBoardMove(
        items,
        byTitle("Product intern").id,
        byTitle("Associate PM intern").id
      )
    ).toEqual({
      stage: "inbox",
      beforeCardId: byTitle("Associate PM intern").id,
    })
  })

  it("lands after the card it is dropped on, moving down", () => {
    expect(
      settleBoardMove(
        items,
        byTitle("Associate PM intern").id,
        byTitle("Product intern").id
      )
    ).toEqual({ stage: "inbox", beforeCardId: null })
  })

  it("keeps the order when it is dropped on itself", () => {
    const id = byTitle("Product intern").id
    expect(settleBoardMove(items, id, id)).toEqual({
      stage: "inbox",
      beforeCardId: null,
    })
  })

  it("returns null for a card that is not on the board", () => {
    expect(settleBoardMove(items, "missing", "inbox")).toBeNull()
  })
})

describe("boardAnnouncements", () => {
  const announce = boardAnnouncements(items)
  const active = { id: byTitle("Business analyst intern").id }
  const sent = { id: byTitle("Product analyst intern").id }
  const event = (over: { id: string } | null) =>
    ({ active, over }) as Parameters<typeof announce.onDragEnd>[0]

  it("names the Opportunity and the Stage in OpenCV words", () => {
    expect(announce.onDragStart!({ active } as never)).toBe(
      "Picked up the Opportunity Business analyst intern from Prep"
    )
    expect(announce.onDragOver!(event(sent) as never)).toBe(
      "Business analyst intern is over Sent"
    )
    expect(announce.onDragEnd!(event(sent) as never)).toBe(
      "Moved the Opportunity Business analyst intern to Sent"
    )
    expect(announce.onDragCancel!({ active } as never)).toBe(
      "Cancelled. Business analyst intern stays in Prep"
    )
  })

  it("names a Stage when the card is over the Stage itself", () => {
    expect(announce.onDragEnd!(event({ id: "closed" }) as never)).toBe(
      "Moved the Opportunity Business analyst intern to Closed"
    )
  })
})
