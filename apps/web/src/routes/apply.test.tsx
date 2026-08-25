import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"

import { APPLY_DRAG_TYPE, SEED_CARDS } from "@/features/apply/apply-types.ts"
import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { createAppRouter } from "@/router.tsx"

function renderApply() {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [SURFACE_PATHS.apply] }),
  })

  return {
    router,
    ...render(createElement(RouterProvider, { router })),
  }
}

async function expectApplyLive() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apply" })
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument()
  expect(screen.getByText("Inbox")).toBeInTheDocument()
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

function expectNoVisibleFitScore() {
  expect(screen.queryByText(/Fit score/i)).not.toBeInTheDocument()
  expect(screen.queryByText("/ 100")).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/fit/i)).not.toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  for (const card of SEED_CARDS) {
    expect(
      screen.queryByDisplayValue(String(card.fit))
    ).not.toBeInTheDocument()
  }
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Apply workspace", () => {
  it("renders Stages and seed cards instead of the stub", async () => {
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
    expect(dataTransfer.getData(APPLY_DRAG_TYPE)).toBe("3")

    expect(
      within(stageColumn("sent")).getByText("Business analyst intern")
    ).toBeInTheDocument()
    expect(
      within(stageColumn("prep")).queryByText("Business analyst intern")
    ).not.toBeInTheDocument()
    expect(
      within(stageColumn("sent")).getByText("Product analyst intern")
    ).toBeInTheDocument()
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
    renderApply()
    await expectApplyLive()

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }))

    expect(screen.getByText("August 2026")).toBeInTheDocument()
    expect(screen.getByText(/jobs with a track date/)).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()
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

  it("marks unfinished chrome as coming soon instead of silent no-ops", async () => {
    renderApply()
    await expectApplyLive()

    const filter = screen.getByRole("button", { name: /filter/i })
    const add = screen.getByRole("button", { name: /add job/i })
    expect(filter).toBeDisabled()
    expect(add).toBeDisabled()
    expect(filter).toHaveTextContent("Coming soon")
    expect(add).toHaveTextContent("Coming soon")
    expect(
      screen.getByRole("button", { name: "Inbox column menu — coming soon" })
    ).toBeDisabled()

    fireEvent.click(
      screen.getByRole("button", { name: /Associate PM intern/ })
    )
    const linkPaper = await screen.findByRole("button", {
      name: "Link Paper docs — coming soon",
    })
    expect(linkPaper).toBeDisabled()
  })
})
