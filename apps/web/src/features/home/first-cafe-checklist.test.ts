import { describe, expect, it } from "vitest"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"

import {
  FIRST_CAFE_CHECKLIST_ITEMS,
  completeFirstCafeItem,
  dismissFirstCafeChecklist,
  firstCafeItemForVisit,
  parseFirstCafeState,
} from "./first-cafe-checklist.ts"

describe("first-café checklist", () => {
  it("keeps four Home items with real surface deep-links", () => {
    expect(FIRST_CAFE_CHECKLIST_ITEMS).toHaveLength(4)
    expect(FIRST_CAFE_CHECKLIST_ITEMS.map((item) => item.id)).toEqual([
      "sample-cv",
      "pitch",
      "apply",
      "email",
    ])
    expect(FIRST_CAFE_CHECKLIST_ITEMS[0]).toMatchObject({
      to: SURFACE_PATHS.paper,
      search: { open: "sample" },
    })
    expect(FIRST_CAFE_CHECKLIST_ITEMS[1]?.to).toBe(SURFACE_PATHS.pitch)
    expect(FIRST_CAFE_CHECKLIST_ITEMS[2]?.to).toBe(SURFACE_PATHS.apply)
    expect(FIRST_CAFE_CHECKLIST_ITEMS[3]).toMatchObject({
      to: SURFACE_PATHS.settings,
      search: { tab: "apps" },
      optional: true,
    })
  })

  it("completes a visit to the linked surface and ignores Home", () => {
    expect(firstCafeItemForVisit(SURFACE_PATHS.paper)).toBe("sample-cv")
    expect(firstCafeItemForVisit(SURFACE_PATHS.pitch)).toBe("pitch")
    expect(firstCafeItemForVisit(SURFACE_PATHS.apply)).toBe("apply")
    expect(firstCafeItemForVisit(SURFACE_PATHS.settings, { tab: "apps" })).toBe(
      "email"
    )
    expect(firstCafeItemForVisit(SURFACE_PATHS.settings)).toBeNull()
    expect(firstCafeItemForVisit(SURFACE_PATHS.home)).toBeNull()
  })

  it("parses storage without inventing extra items", () => {
    expect(parseFirstCafeState(null)).toEqual({
      dismissed: false,
      completed: [],
    })
    expect(parseFirstCafeState("{")).toEqual({
      dismissed: false,
      completed: [],
    })
    expect(
      parseFirstCafeState(
        JSON.stringify({
          dismissed: true,
          completed: ["sample-cv", "wizard", "pitch"],
        })
      )
    ).toEqual({
      dismissed: true,
      completed: ["sample-cv", "pitch"],
    })
  })

  it("marks one item done and dismisses the whole list", () => {
    const started = parseFirstCafeState(null)
    const afterVisit = completeFirstCafeItem(started, "sample-cv")
    expect(afterVisit.completed).toEqual(["sample-cv"])
    expect(completeFirstCafeItem(afterVisit, "sample-cv")).toBe(afterVisit)

    const hidden = dismissFirstCafeChecklist(afterVisit)
    expect(hidden).toEqual({
      dismissed: true,
      completed: ["sample-cv"],
    })
    expect(dismissFirstCafeChecklist(hidden)).toBe(hidden)
  })
})
