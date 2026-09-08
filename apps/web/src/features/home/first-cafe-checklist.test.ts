import { describe, expect, it } from "vitest"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { APPLY_OPEN_GUIDE } from "@/features/apply/apply-search.ts"

import {
  FIRST_CAFE_CHECKLIST_ITEMS,
  completeFirstCafeItem,
  dismissFirstCafeChecklist,
  firstCafeItemForVisit,
  firstCafeStorageKey,
  firstCafeVisitToRecord,
  parseFirstCafeState,
  readFirstCafeState,
  recordFirstCafeVisit,
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
    expect(FIRST_CAFE_CHECKLIST_ITEMS[2]).toMatchObject({
      to: SURFACE_PATHS.apply,
      search: { open: APPLY_OPEN_GUIDE },
    })
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

  it("ignores pending or unresolved Apply flickers during signup bootstrap", () => {
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "pending",
        resolvedPathname: SURFACE_PATHS.home,
        resolvedSearch: {},
      })
    ).toBeNull()
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "idle",
        resolvedPathname: undefined,
        resolvedSearch: {},
      })
    ).toBeNull()
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "idle",
        resolvedPathname: SURFACE_PATHS.home,
        resolvedSearch: {},
      })
    ).toBeNull()
    expect(
      firstCafeVisitToRecord({
        userId: undefined,
        status: "idle",
        resolvedPathname: SURFACE_PATHS.apply,
        resolvedSearch: {},
      })
    ).toBeNull()
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "idle",
        pathname: SURFACE_PATHS.apply,
        resolvedPathname: SURFACE_PATHS.home,
        resolvedSearch: {},
      })
    ).toBeNull()
  })

  it("records Apply only after a settled visit to /app/apply", () => {
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "idle",
        resolvedPathname: SURFACE_PATHS.apply,
        resolvedSearch: {},
      })
    ).toEqual({
      pathname: SURFACE_PATHS.apply,
      search: {},
    })
  })

  it("records only the Paper sample after that visit, not Apply", () => {
    const userId = "user_fresh"
    expect(firstCafeStorageKey(userId)).toContain(userId)

    const afterHome = recordFirstCafeVisit(userId, SURFACE_PATHS.home)
    expect(afterHome.completed).toEqual([])

    const afterPaper = recordFirstCafeVisit(userId, SURFACE_PATHS.paper, {
      open: "sample",
    })
    expect(afterPaper.completed).toEqual(["sample-cv"])
    expect(readFirstCafeState(userId).completed).toEqual(["sample-cv"])

    const afterHomeAgain = recordFirstCafeVisit(userId, SURFACE_PATHS.home)
    expect(afterHomeAgain.completed).toEqual(["sample-cv"])
  })
})
