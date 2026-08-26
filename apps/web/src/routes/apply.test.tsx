import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { localIsoDate } from "@/features/apply/apply-calendar.tsx"
import { APPLY_DRAG_TYPE } from "@/features/apply/apply-types.ts"
import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"

const SAMPLE_CARDS = sampleApplyCards()
const ANALYST_ID = SAMPLE_CARDS.find(
  (card) => card.title === "Business analyst intern"
)!.id

function renderApply() {
  return renderApp(SURFACE_PATHS.apply)
}

async function expectApplyLive() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apply" })
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument()
  expect(await screen.findByText("Inbox")).toBeInTheDocument()
  expect(screen.getByText("Prep")).toBeInTheDocument()
  expect(screen.getByText("Sent")).toBeInTheDocument()
  expect(screen.getByText("Live")).toBeInTheDocument()
  expect(screen.getByText("Closed")).toBeInTheDocument()
  expect(screen.getByText("Associate PM intern")).toBeInTheDocument()
  expect(screen.queryByText(SURFACE_COPY.apply.body)).not.toBeInTheDocument()
}

function stageColumn(id: string) {
  const column = document.querySelector(`[data-stage="${id}"]`)
  expect(column).toBeTruthy()
  return column as HTMLElement
}

function createDataTransfer() {
  const store: Record<string, string> = {}
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as File[],
    items: [] as unknown[],
    types: [] as string[],
    setData(type: string, value: string) {
      store[type] = value
      if (!this.types.includes(type)) this.types.push(type)
    },
    getData(type: string) {
      return store[type] ?? ""
    },
    clearData() {
      for (const key of Object.keys(store)) delete store[key]
      this.types.length = 0
    },
    setDragImage() {},
  }
}

function dragCardToStage(cardName: string, stageId: string) {
  const card = screen.getByRole("button", { name: new RegExp(cardName) })
  const dataTransfer = createDataTransfer()
  fireEvent.dragStart(card, { dataTransfer })
  fireEvent.drag(card, { dataTransfer })
  const column = stageColumn(stageId)
  fireEvent.dragOver(column, { dataTransfer })
  fireEvent.drop(column, { dataTransfer })
  fireEvent.dragEnd(card, { dataTransfer })
  return dataTransfer
}

function dragCardOntoCard(sourceName: string, targetName: string) {
  const source = screen.getByRole("button", { name: new RegExp(sourceName) })
  const target = screen.getByRole("button", { name: new RegExp(targetName) })
  const dataTransfer = createDataTransfer()
  fireEvent.dragStart(source, { dataTransfer })
  fireEvent.drag(source, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
  fireEvent.dragEnd(source, { dataTransfer })
}

function expectNoVisibleFitScore() {
  expect(screen.queryByText(/Fit score/i)).not.toBeInTheDocument()
  expect(screen.queryByText("/ 100")).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/fit/i)).not.toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\b(48|61|68|74|79)\b/)
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("Apply workspace", () => {
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
    expect(within(stageColumn("live")).getByText("Drop a job here")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expectNoVisibleFitScore()
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

  it("opens job detail from a card without showing Fit", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(
      screen.getByRole("button", { name: /Associate PM intern/ })
    )

    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("Associate PM intern")).toBeInTheDocument()
    expect(within(panel).getByDisplayValue("Local startup")).toBeInTheDocument()
    expect(within(panel).getByText("Notes")).toBeInTheDocument()
    expect(
      within(panel).getByDisplayValue(
        "JD wants discovery notes + 1 shipped experiment."
      )
    ).toBeInTheDocument()
    expectNoVisibleFitScore()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()

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
      screen.getByRole("button", { name: "Associate PM intern" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Product intern" })
    ).toBeInTheDocument()
    expectNoVisibleFitScore()

    fireEvent.click(screen.getByRole("button", { name: "Associate PM intern" }))
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
    expect(screen.queryByText("Business analyst intern")).not.toBeInTheDocument()
  })

  it("marks unfinished chrome as coming soon and enables Add job", async () => {
    renderApply()
    await expectApplyLive()

    const filter = screen.getByRole("button", { name: /filter/i })
    const add = screen.getByRole("button", { name: /add job/i })
    expect(filter).toBeDisabled()
    expect(add).toBeEnabled()
    expect(filter).toHaveTextContent("Coming soon")
    expect(add).not.toHaveTextContent("Coming soon")
    expect(
      screen.getByRole("button", { name: "Inbox column menu — coming soon" })
    ).toBeDisabled()

    fireEvent.click(
      screen.getByRole("button", { name: /Associate PM intern/ })
    )
    expect(
      await screen.findByRole("button", { name: "Link Paper docs" })
    ).toBeEnabled()
  })

  it("confirms before deleting a job and does not run on dismiss", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(
      screen.getByRole("button", { name: /Associate PM intern/ })
    )
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    fireEvent.click(within(panel).getByRole("button", { name: "Delete job" }))

    const confirm = await screen.findByRole("dialog", { name: "Delete job" })
    expect(confirm).toHaveTextContent("Associate PM intern at Local startup")
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog", { name: "Delete job" })).not.toBeInTheDocument()
    expect(screen.getByText("Associate PM intern")).toBeInTheDocument()
    expect(
      screen.getByRole("complementary", { name: "Job detail" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delete job" }))
    const confirmAgain = await screen.findByRole("dialog", { name: "Delete job" })
    fireEvent.click(within(confirmAgain).getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(screen.queryByText("Associate PM intern")).not.toBeInTheDocument()
    })
    expect(
      screen.queryByRole("complementary", { name: "Job detail" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Product intern")).toBeInTheDocument()
  })

  it("creates a job and links a Paper doc from job detail", async () => {
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: /add job/i }))
    const panel = await screen.findByRole("complementary", {
      name: "Job detail",
    })
    expect(within(panel).getByDisplayValue("Untitled role")).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole("button", { name: "Link Paper docs" }))
    const menu = await screen.findByRole("menu", { name: "Link Paper docs" })
    fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: /PM track CV/ }))
    expect(
      await within(menu).findByRole("menuitemcheckbox", { name: /PM track CV/ })
    ).toHaveAttribute("aria-checked", "true")
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
