import { describe, expect, it } from "vitest"
import type { ApplyCard } from "@workspace/domain"

import {
  activeFilterCount,
  applyFilterGroups,
  filterApplyCards,
} from "@/features/apply/apply-filters.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"

const cards = sampleApplyCards() as ApplyCard[]
const titles = (list: ApplyCard[]) => list.map((card) => card.title)

describe("applyFilterGroups", () => {
  it("offers the five Stages, each company once, and a starred switch", () => {
    const [stage, company, starred] = applyFilterGroups(cards)
    expect(stage!.options.map((o) => o.label)).toEqual([
      "Inbox",
      "Prep",
      "Sent",
      "Live",
      "Closed",
    ])
    expect(company!.options.map((o) => o.id)).toEqual(
      [...new Set(cards.map((c) => c.company))].sort()
    )
    expect(starred!.options).toEqual([{ id: "yes", label: "Starred only" }])
  })
})

describe("filterApplyCards", () => {
  it("returns every card with no search and no filters", () => {
    expect(filterApplyCards(cards, "  ", {})).toHaveLength(cards.length)
  })

  it("matches the search words on title or company", () => {
    expect(titles(filterApplyCards(cards, "regional", {}))).toEqual([
      "Business analyst intern",
    ])
  })

  it("keeps cards in any picked Stage and in any picked company", () => {
    expect(
      titles(filterApplyCards(cards, "", { stage: ["sent", "closed"] }))
    ).toEqual(["Product analyst intern", "UX research intern"])
    expect(
      titles(
        filterApplyCards(cards, "", { company: ["Agency", "Regional bank"] })
      ).sort()
    ).toEqual(["Business analyst intern", "UX research intern"])
  })

  it("combines groups and search with AND", () => {
    expect(
      filterApplyCards(cards, "intern", {
        stage: ["inbox"],
        company: ["Agency"],
      })
    ).toEqual([])
  })

  it("keeps only starred cards when asked", () => {
    const result = filterApplyCards(cards, "", { starred: ["yes"] })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((card) => card.starred)).toBe(true)
  })
})

describe("activeFilterCount", () => {
  it("counts every picked option", () => {
    expect(activeFilterCount({})).toBe(0)
    expect(
      activeFilterCount({ stage: ["inbox", "prep"], starred: ["yes"] })
    ).toBe(3)
  })
})
