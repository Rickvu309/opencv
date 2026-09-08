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
  nextFirstCafeNudge,
  parseFirstCafeState,
  readFirstCafeState,
  recordFirstCafeVisit,
  recordFirstCafeWin,
  skipFirstCafeNudge,
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
    expect(firstCafeItemForVisit("/app")).toBeNull()
    expect(firstCafeItemForVisit(`${SURFACE_PATHS.apply}/`)).toBeNull()
  })

  it("maps each surface visit to exactly one checklist item", () => {
    expect(firstCafeItemForVisit(SURFACE_PATHS.apply)).toBe("apply")
    expect(firstCafeItemForVisit(SURFACE_PATHS.apply)).not.toBe("sample-cv")
    expect(firstCafeItemForVisit(SURFACE_PATHS.apply)).not.toBe("pitch")
    expect(firstCafeItemForVisit(SURFACE_PATHS.paper)).not.toBe("apply")
    expect(firstCafeItemForVisit(SURFACE_PATHS.pitch)).not.toBe("apply")
  })

  it("parses storage without inventing extra items", () => {
    expect(parseFirstCafeState(null)).toEqual({
      dismissed: false,
      completed: [],
      nudgeSkipped: false,
      wins: [],
    })
    expect(parseFirstCafeState("{")).toEqual({
      dismissed: false,
      completed: [],
      nudgeSkipped: false,
      wins: [],
    })
    expect(
      parseFirstCafeState(
        JSON.stringify({
          dismissed: true,
          completed: ["sample-cv", "wizard", "pitch"],
          nudgeSkipped: true,
          wins: ["pitch", "tour"],
        })
      )
    ).toEqual({
      dismissed: true,
      completed: ["sample-cv", "pitch"],
      nudgeSkipped: true,
      wins: ["pitch"],
    })
  })

  it("marks one item done and dismisses the whole list", () => {
    const started = parseFirstCafeState(null)
    const afterVisit = completeFirstCafeItem(started, "sample-cv")
    expect(afterVisit.completed).toEqual(["sample-cv"])
    expect(afterVisit.nudgeSkipped).toBe(false)
    expect(completeFirstCafeItem(afterVisit, "sample-cv")).toBe(afterVisit)

    const hidden = dismissFirstCafeChecklist(afterVisit)
    expect(hidden).toEqual({
      dismissed: true,
      completed: ["sample-cv"],
      nudgeSkipped: false,
      wins: [],
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
        historyPathname: SURFACE_PATHS.apply,
        resolvedSearch: {},
      })
    ).toEqual({
      pathname: SURFACE_PATHS.apply,
      search: {},
    })
  })

  it("ignores Paper and Pitch store flashes while history stays on Apply", () => {
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "idle",
        pathname: SURFACE_PATHS.paper,
        resolvedPathname: SURFACE_PATHS.paper,
        historyPathname: SURFACE_PATHS.apply,
        resolvedSearch: {},
      })
    ).toBeNull()
    expect(
      firstCafeVisitToRecord({
        userId: "user_fresh",
        status: "idle",
        pathname: SURFACE_PATHS.pitch,
        resolvedPathname: SURFACE_PATHS.pitch,
        historyPathname: SURFACE_PATHS.apply,
        resolvedSearch: {},
      })
    ).toBeNull()
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

  it("records Apply alone without completing Sample CV or Pitch", () => {
    const userId = "user_apply_only"
    const afterApply = recordFirstCafeVisit(userId, SURFACE_PATHS.apply, {
      open: APPLY_OPEN_GUIDE,
    })
    expect(afterApply.completed).toEqual(["apply"])
    expect(readFirstCafeState(userId).completed).toEqual(["apply"])
    expect(afterApply.completed).not.toContain("sample-cv")
    expect(afterApply.completed).not.toContain("pitch")
  })

  it("records Pitch alone without completing Sample CV or Apply", () => {
    const userId = "user_pitch_only"
    const afterPitch = recordFirstCafeVisit(userId, SURFACE_PATHS.pitch)
    expect(afterPitch.completed).toEqual(["pitch"])
    expect(readFirstCafeState(userId).completed).toEqual(["pitch"])
    expect(afterPitch.completed).not.toContain("sample-cv")
    expect(afterPitch.completed).not.toContain("apply")
  })
})

describe("first-café next nudge", () => {
  it("stays quiet until at least one Paper, Pitch, or Apply win", () => {
    expect(
      nextFirstCafeNudge({ completed: [], nudgeSkipped: false })
    ).toBeNull()
    expect(
      nextFirstCafeNudge({
        completed: ["email"],
        nudgeSkipped: false,
      })
    ).toBeNull()
  })

  it("points at the next existing Paper / Pitch / Apply path after one win", () => {
    const afterSample = nextFirstCafeNudge({
      completed: ["sample-cv"],
      nudgeSkipped: false,
    })
    expect(afterSample).toMatchObject({
      id: "pitch",
      label: "Make Pitch yours",
      to: SURFACE_PATHS.pitch,
    })

    const afterApply = nextFirstCafeNudge({
      completed: ["apply"],
      nudgeSkipped: false,
    })
    expect(afterApply).toMatchObject({
      id: "sample-cv",
      label: "Open the sample CV",
      to: SURFACE_PATHS.paper,
      search: { open: "sample" },
    })

    const afterPitch = nextFirstCafeNudge({
      completed: ["pitch"],
      nudgeSkipped: false,
    })
    expect(afterPitch).toMatchObject({
      id: "sample-cv",
      to: SURFACE_PATHS.paper,
    })

    const afterTwo = nextFirstCafeNudge({
      completed: ["sample-cv", "pitch"],
      nudgeSkipped: false,
    })
    expect(afterTwo).toMatchObject({
      id: "apply",
      label: "Triage one Apply card",
      to: SURFACE_PATHS.apply,
      search: { open: APPLY_OPEN_GUIDE },
    })
  })

  it("treats Pitch clear as a win without writing checklist checks", () => {
    const completed: ("sample-cv" | "pitch" | "apply" | "email")[] = []
    const nudge = nextFirstCafeNudge({
      completed,
      nudgeSkipped: false,
      extraWins: ["pitch"],
    })
    expect(nudge).toMatchObject({
      id: "sample-cv",
      to: SURFACE_PATHS.paper,
    })
    expect(completed).toEqual([])

    const userId = "user_pitch_clear"
    const noted = recordFirstCafeWin(userId, "pitch")
    expect(noted.wins).toEqual(["pitch"])
    expect(noted.completed).toEqual([])
    expect(readFirstCafeState(userId).completed).toEqual([])
    expect(readFirstCafeState(userId).wins).toEqual(["pitch"])
  })

  it("does not invent a Settings or email nudge, and hides when craft wins are done", () => {
    expect(
      nextFirstCafeNudge({
        completed: ["sample-cv", "pitch", "apply"],
        nudgeSkipped: false,
      })
    ).toBeNull()
    expect(
      nextFirstCafeNudge({
        completed: ["sample-cv", "pitch", "apply", "email"],
        nudgeSkipped: false,
      })
    ).toBeNull()
  })

  it("is skippable without marking leftover items done", () => {
    const afterApply = {
      dismissed: false,
      completed: ["apply"] as const,
      nudgeSkipped: false,
      wins: [],
    }
    const skipped = skipFirstCafeNudge(afterApply)
    expect(skipped).toEqual({
      dismissed: false,
      completed: ["apply"],
      nudgeSkipped: true,
      wins: [],
    })
    expect(skipFirstCafeNudge(skipped)).toBe(skipped)
    expect(
      nextFirstCafeNudge({
        completed: skipped.completed,
        nudgeSkipped: skipped.nudgeSkipped,
      })
    ).toBeNull()
    expect(skipped.completed).toEqual(["apply"])
  })
})
