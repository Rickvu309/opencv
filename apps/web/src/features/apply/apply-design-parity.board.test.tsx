import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, it, vi } from "vitest"

import { NOW, fill, penJobs } from "@/test/apply-pen-fixtures.ts"
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
import month from "./design/w9-7-calendar-month.snapshot.json"
import monthStyles from "./design/w9-7-calendar-month.styles.json"
import week from "./design/w9-8-calendar-week.snapshot.json"
import weekStyles from "./design/w9-8-calendar-week.styles.json"

// Each Apply state renders the data its opencv.pen frame draws, at the frame's
// clock, and must show every text of the frame and at least as many drawn
// icons. Sizes, weights and colours are measured in Chromium by
// .claude/skills/verify-app-ui (pnpm --filter web verify:apply-pen).

// Texts a frame draws that the product cannot show, each with its reason.
// Remove an entry when the data exists; a stale entry fails.
const NOT_SHOWN: Record<string, Record<string, string>> = {
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

// Icons a frame draws for data the product does not have.
const ICONS_NOT_DRAWN: Record<string, { count: number; reason: string }> = {
  w94: { count: 6, reason: "company logos; rows show the initials tile" },
  w97: { count: 4, reason: "the chips of the dates in NOT_SHOWN" },
}

describe("Apply board, list and calendar match W9 of opencv.pen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
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
      NOT_SHOWN.w94,
      ICONS_NOT_DRAWN.w94.count
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
  it("W9.6 Drag to stage keeps the board texts", async () => {
    setMockJobs(penJobs())
    renderApp("/apply")
    await screen.findByRole("region", { name: "Saved" })
    expectFrame(main(), drag, null, {
      ...Object.fromEntries(
        drag.sections
          .flatMap((section) => section.texts)
          .filter((text) => !board.sections.some((s) => s.texts.includes(text)))
          .map((text) => [text, "drawn only while a card is dragged"])
      ),
    })
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
      NOT_SHOWN.w97,
      ICONS_NOT_DRAWN.w97.count
    )
  })
  it("W9.8 Calendar week", async () => {
    setMockJobs(penJobs())
    renderApp("/apply?view=calendar&span=week")
    fireEvent.click(await screen.findByRole("button", { name: "Next week" }))
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    await screen.findByRole("heading", { name: "November 2026" })
    expectFrame(main(), week, weekStyles, NOT_SHOWN.w98)
  })
})
