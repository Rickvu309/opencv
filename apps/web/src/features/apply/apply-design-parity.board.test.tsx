import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PEN_FRAME_CLOCK, fill, penJobs } from "@/test/apply-pen-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { expectFrame, main } from "@/test/pen-frame-text.ts"
import { renderApp } from "@/test/render-app.tsx"

import boardEmpty from "./design/w9-1-board-empty.snapshot.json"
import boardEmptyStyles from "./design/w9-1-board-empty.styles.json"
import board from "./design/w9-3-board.snapshot.json"
import boardStyles from "./design/w9-3-board.styles.json"
import list from "./design/w9-4-list.snapshot.json"
import listStyles from "./design/w9-4-list.styles.json"
import noResults from "./design/w9-5-filters-no-results.snapshot.json"
import noResultsStyles from "./design/w9-5-filters-no-results.styles.json"
import drag from "./design/w9-6-drag-to-stage.snapshot.json"
import dragStyles from "./design/w9-6-drag-to-stage.styles.json"
import month from "./design/w9-7-calendar-month.snapshot.json"
import monthStyles from "./design/w9-7-calendar-month.styles.json"
import week from "./design/w9-8-calendar-week.snapshot.json"
import weekStyles from "./design/w9-8-calendar-week.styles.json"

const FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW: Record<
  string,
  Record<string, string>
> = {
  w94: {
    "Round 2 on Nov 3":
      "JobView has no interview round; the row says Interview on Nov 3",
  },
  w97: {
    "Content intern": "the Oct 9 closed date is not stored",
    "Business analyst":
      "applied dates and inbox follow-ups are not stored (Oct 14, Oct 25)",
    "Product analyst": "the frame's Oct 19 interview contradicts W9.8 (Nov 3)",
    "Marketing intern": "the Oct 21 applied date is not stored",
  },
  w98: {
    "Round 2 interview": "JobView has no interview round",
    "UX research due":
      "the week frame shortens the title; the deadline chip shows UX research intern",
  },
}

const ICONS_FOR_DATA_THE_PRODUCT_DOES_NOT_HAVE: Record<
  string,
  { count: number; reason: string }
> = {
  w94: { count: 6, reason: "company logos; rows show the initials tile" },
  w97: {
    count: 4,
    reason: "the chips of the dates in FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW",
  },
}

const DROP_LINE_NEEDS_A_REAL_POINTER = null

function laneRects320pxApartBecauseJsdomHasNoLayout(order: string[]) {
  return function (this: HTMLElement) {
    const lane = this.closest("[data-slot='kanban-board']")
    const stage =
      lane?.getAttribute("data-stage") ?? this.getAttribute("data-stage")
    const index = stage ? order.indexOf(stage) : -1
    const card = this.closest("[data-slot='kanban-card']")
    if (index < 0) return new DOMRect(24, 96, 200, 80)
    return new DOMRect(
      index * 320 + (card ? 24 : 0),
      card ? 96 : 0,
      card ? 200 : 244,
      card ? 80 : 480
    )
  }
}

describe("Apply board, list and calendar match W9 of opencv.pen at the frame clock, with every frame text and at least as many icons; sizes, weights and colours stay with verify-app-ui", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(PEN_FRAME_CLOCK)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("W9.1 Board empty", async () => {
    setMockJobs([])
    renderApp("/apply")
    await screen.findByRole("heading", { name: "Track your first job" })
    expectFrame(main(), boardEmpty, boardEmptyStyles)
  })
  it("W9.3 Board", async () => {
    setMockJobs(penJobs())
    renderApp("/apply")
    await screen.findByRole("region", { name: "Saved" })
    expectFrame(main(), board, boardStyles)
  })
  it("W9.4 List", async () => {
    setMockJobs(penJobs())
    renderApp("/apply?view=list")
    await screen.findByText("Product analyst intern")
    expectFrame(
      main(),
      list,
      listStyles,
      FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW.w94,
      ICONS_FOR_DATA_THE_PRODUCT_DOES_NOT_HAVE.w94.count
    )
  })
  it("W9.5 Filters no results", async () => {
    setMockJobs(penJobs())
    renderApp("/apply")
    await screen.findByRole("region", { name: "Saved" })
    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fill("Company", "Regional bank")
    fill("Location", "Hanoi")
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await screen.findByText("No jobs match these filters")
    expectFrame(main(), noResults, noResultsStyles)
  })
  it("W9.6 Drag to stage", async () => {
    const order = ["saved", "applied", "interview", "offer", "closed"]
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(laneRects320pxApartBecauseJsdomHasNoLayout(order))
    const press = async (target: EventTarget, code: string) => {
      await act(async () => {
        fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code })
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }
    try {
      setMockJobs(penJobs())
      renderApp("/apply")
      const card = await screen.findByRole("button", {
        name: "Business analyst intern, Regional bank",
      })
      card.focus()
      await press(card, "Space")
      await press(document, "ArrowRight")
      const lifted = document.querySelector("[data-slot=kanban-overlay]")
      expect(lifted).toHaveTextContent("Business analyst intern")
      expectFrame(main(), drag, DROP_LINE_NEEDS_A_REAL_POINTER)
      const marks = dragStyles.sections.reduce(
        (sum, section) => sum + section.marks.length,
        0
      )
      const drawn =
        main().querySelectorAll("svg, img").length +
        (lifted?.querySelectorAll("svg, img").length ?? 0)
      expect(drawn).toBeGreaterThanOrEqual(marks)
      await press(document, "Escape")
    } finally {
      rect.mockRestore()
    }
  })
  it("W9.7 Calendar month", async () => {
    setMockJobs(penJobs({ "Junior Marketing": { deadline: "2026-10-25" } }))
    renderApp("/apply?view=calendar&span=month")
    await screen.findByRole("heading", { name: "October 2026" })
    await screen.findByText(/10:00 Associate PM/)
    expectFrame(
      main(),
      month,
      monthStyles,
      FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW.w97,
      ICONS_FOR_DATA_THE_PRODUCT_DOES_NOT_HAVE.w97.count
    )
  })
  it("W9.8 Calendar week", async () => {
    setMockJobs(penJobs())
    renderApp("/apply?view=calendar&span=week")
    fireEvent.click(await screen.findByRole("button", { name: "Next week" }))
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    await screen.findByRole("heading", { name: "November 2026" })
    expectFrame(
      main(),
      week,
      weekStyles,
      FRAME_TEXTS_THE_PRODUCT_CANNOT_SHOW.w98
    )
  })
})
