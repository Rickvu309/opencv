import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import {
  APPLY_DEMO_HINT,
  APPLY_DEMO_LABEL,
} from "@/features/apply/apply-job-structure.ts"
import { APPLY_OPEN_GUIDE } from "@/features/apply/apply-search.ts"
import { APPLY_DRAG_TYPE, localIsoDate } from "@/features/apply/apply-types.ts"
import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { readFirstCafeState } from "@/features/home/first-cafe-checklist.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  installApplyTestLifecycle,
  ANALYST_ID,
  renderApply,
  expectApplyLive,
  stageColumn,
  dragCardToStage,
  dragCardOntoCard,
  expectNoVisibleFitScore,
} from "@/test/apply-route-fixtures.ts"

installApplyTestLifecycle()

describe("Apply board", () => {
  it("renders Stages and server cards instead of the stub", async () => {
    renderApply()
    await expectApplyLive()
    expect(
      within(stageColumn("inbox")).getByText("Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("closed")).getByText("UX research intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("live")).getByText("Drop a job here")
    ).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expectNoVisibleFitScore()

    expect(
      within(stageColumn("inbox")).getByRole("button", {
        name: "Associate PM intern at Local startup, Demo",
      })
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getAllByText(APPLY_DEMO_LABEL).length
    ).toBeGreaterThan(0)
    expect(
      within(stageColumn("prep")).getByText(APPLY_DEMO_LABEL)
    ).toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText(APPLY_DEMO_LABEL)
    ).toBeInTheDocument()
    expect(
      within(stageColumn("closed")).getByText(APPLY_DEMO_LABEL)
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByRole("button", {
        name: "Product intern at Fintech scale-up",
      })
    ).toBeInTheDocument()
    expect(
      within(
        stageColumn("inbox").querySelector(
          '[aria-label="Product intern at Fintech scale-up"]'
        ) as HTMLElement
      ).queryByText(APPLY_DEMO_LABEL)
    ).not.toBeInTheDocument()
  })

  it("drags a card to another Stage and keeps the move", async () => {
    renderApply()
    await expectApplyLive()

    const dataTransfer = dragCardToStage("Business analyst intern", "sent")
    expect(dataTransfer.getData(APPLY_DRAG_TYPE)).toBe(ANALYST_ID)

    await waitFor(() => {
      expect(
        within(stageColumn("sent")).getByText("Business analyst intern")
      ).toBeInTheDocument()
    })
    expect(
      within(stageColumn("prep")).queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
  })

  it("reorders a card within a Stage", async () => {
    renderApply()
    await expectApplyLive()

    dragCardOntoCard("Product intern", "Associate PM intern")

    await waitFor(() => {
      const titles = [
        ...stageColumn("inbox").querySelectorAll("[data-card-id]"),
      ].map((node) => node.getAttribute("aria-label"))
      expect(titles[0]).toMatch(/Product intern/)
      expect(titles[1]).toMatch(/Associate PM intern/)
    })
  })

  it("does not auto-open a card without the guided deep-link", async () => {
    renderApply()
    await expectApplyLive()
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Move to Prep" })
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Associate PM intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
  })

  it("opens one seeded card from the Home guided deep-link without emptying the board", async () => {
    renderApp(`${SURFACE_PATHS.apply}?open=${APPLY_OPEN_GUIDE}`)
    await expectApplyLive()

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(
      within(panel).getByRole("button", { name: "Move to Prep" })
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")

    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("closed")).getByText("UX research intern")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /skip tour|continue tour/i })
    ).not.toBeInTheDocument()
    expect(readFirstCafeState("user_test").completed).toEqual([])
  })

  it("moves the guided inbox card to Prep and keeps the other cards", async () => {
    renderApp(`${SURFACE_PATHS.apply}?open=${APPLY_OPEN_GUIDE}`)
    await expectApplyLive()

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Move to Prep" }))

    await waitFor(() => {
      expect(
        within(stageColumn("prep")).getByText("Associate PM intern")
      ).toBeInTheDocument()
    })
    expect(
      within(stageColumn("inbox")).queryByText("Associate PM intern")
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("inbox")).getByText("Product intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Move to Prep" })
    ).not.toBeInTheDocument()
    expect(
      within(
        await screen.findByRole("complementary", { name: "Job detail" })
      ).getByRole("combobox", { name: "Next step" })
    ).toHaveTextContent("Follow-up")
    expect(readFirstCafeState("user_test").completed).toEqual(["apply"])
  })

  it("opens job detail from a card without showing Fit", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(
      within(panel).getByDisplayValue("Associate PM intern")
    ).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(
      await within(panel).findByRole("region", { name: "Linked Paper" })
    ).toHaveTextContent("Cover: Associate PM intern")
    expect(within(panel).getByText("Notes")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue(
        "JD wants discovery notes + 1 shipped experiment."
      )
    ).toBeInTheDocument()
    expect(within(panel).getByRole("region", { name: "Source" })).toBeTruthy()
    expect(
      within(panel).getByRole("region", { name: "Next step" })
    ).toBeTruthy()
    expect(
      within(panel).getByRole("textbox", { name: "Source" })
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole("combobox", { name: "Next step" })
    ).toBeInTheDocument()
    expect(within(panel).getByLabelText("Date")).toHaveValue("2026-08-26")
    expect(within(panel).queryByText("Event type")).not.toBeInTheDocument()
    expect(within(panel).queryByText("Track date")).not.toBeInTheDocument()
    expect(within(panel).queryByText("Job posting URL")).not.toBeInTheDocument()
    expectNoVisibleFitScore()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(within(panel).getByText(APPLY_DEMO_LABEL)).toBeInTheDocument()
    expect(within(panel).getByText(APPLY_DEMO_HINT)).toBeInTheDocument()
    expect(
      within(panel).queryByRole("link", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole("button", { name: "Open job posting" })
    ).not.toBeInTheDocument()
    expect(within(panel).queryByDisplayValue(/example\.com/i)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }))
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
  })

  it("renders the calendar of Tracks", async () => {
    const now = new Date(2026, 7, 26, 12)
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)

    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }))

    const monthTitle = `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()}`
    expect(screen.getByText(monthTitle)).toBeInTheDocument()
    expect(screen.getByText(/jobs with a track date/)).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()

    const todayIso = localIsoDate(now)
    const todayCell = document.querySelector(`[data-track-date="${todayIso}"]`)
    expect(todayCell).toHaveAttribute("data-today", "true")
    expect(
      within(todayCell as HTMLElement).getByRole("button", {
        name: String(now.getDate()),
      })
    ).toHaveAttribute("aria-current", "date")

    expect(
      screen.getByRole("button", { name: "Associate PM intern · Demo" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Product intern" })
    ).toBeInTheDocument()
    expectNoVisibleFitScore()

    fireEvent.click(
      screen.getByRole("button", { name: "Associate PM intern · Demo" })
    )
    expect(
      await screen.findByRole("complementary", { name: "Job detail" })
    ).toBeInTheDocument()
    expectNoVisibleFitScore()
  })

  it("filters cards by company and keeps the Apply badge in the sidebar", async () => {
    renderApply()
    await expectApplyLive()

    const apply = screen.getByRole("link", { name: "Apply" })
    expect(apply).toHaveAttribute("aria-current", "page")
    expect(apply.querySelector("[data-slot='badge']")).not.toBeNull()

    fireEvent.change(screen.getByRole("textbox", { name: "Search jobs" }), {
      target: { value: "fintech" },
    })

    expect(screen.getByText("Product intern")).toBeInTheDocument()
    expect(screen.queryByText("Associate PM intern")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
  })

  it("fits all five Stages on one glanceable board without Coming-soon chrome", async () => {
    renderApply()
    await expectApplyLive()

    const board = document.querySelector("[data-apply-board]")
    expect(board).toBeTruthy()
    expect(board).toHaveClass("grid-cols-5")
    expect(board?.className ?? "").not.toMatch(/overflow-x-auto/)
    for (const id of ["inbox", "prep", "sent", "live", "closed"] as const) {
      const column = stageColumn(id)
      expect(column.className).not.toMatch(/w-64/)
      expect(column.className).not.toMatch(/shrink-0/)
    }

    expect(
      screen.queryByRole("button", { name: /filter/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /column menu/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument()
    const addJob = screen.getByRole("button", { name: /add job/i })
    expect(addJob).toBeEnabled()
    expect(addJob).not.toHaveTextContent("Coming soon")

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    expect(
      await screen.findByRole("button", { name: "Link Paper docs" })
    ).toBeEnabled()
  })

  it("confirms before deleting a job and does not run on dismiss", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /Associate PM intern/ }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Delete job" }))

    const confirm = await screen.findByRole("dialog", { name: "Delete job" })
    expect(confirm).toHaveTextContent("Associate PM intern at Local startup")
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByRole("dialog", { name: "Delete job" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Associate PM intern")).toBeInTheDocument()
    expect(
      screen.getByRole("complementary", { name: "Job detail" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delete job" }))
    const confirmAgain = await screen.findByRole("dialog", {
      name: "Delete job",
    })
    fireEvent.click(
      within(confirmAgain).getByRole("button", { name: "Delete" })
    )

    await waitFor(() => {
      expect(screen.queryByText("Associate PM intern")).not.toBeInTheDocument()
    })
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Product intern")).toBeInTheDocument()
  })

  it("rolls a failed move back and shows the real error message", async () => {
    const { failNextApplyCommand } = await import("@/test/apply-api-mock.ts")
    const { APPLY_COMMANDS } = await import("@workspace/domain")
    failNextApplyCommand(APPLY_COMMANDS.moveCard, "Column is locked")

    renderApply()
    await expectApplyLive()

    dragCardToStage("Business analyst intern", "sent")

    expect(
      await screen.findByRole("alert", {}, { timeout: 2000 })
    ).toHaveTextContent("Column is locked")
    await waitFor(() => {
      expect(
        within(stageColumn("prep")).getByText("Business analyst intern")
      ).toBeInTheDocument()
    })
    expect(
      within(stageColumn("sent")).queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
  })
})
