import { afterEach, beforeEach, expect, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"
import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"

export const SAMPLE_CARDS = sampleApplyCards()
export const ANALYST_ID = SAMPLE_CARDS.find(
  (card) => card.title === "Business analyst intern"
)!.id

export function renderApply() {
  return renderApp(SURFACE_PATHS.apply)
}

export async function expectApplyLive() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apply" })
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument()
  expect(await screen.findByText("Associate PM intern")).toBeInTheDocument()
  expect(stageColumn("inbox")).toBeTruthy()
  expect(stageColumn("prep")).toBeTruthy()
  expect(stageColumn("sent")).toBeTruthy()
  expect(stageColumn("live")).toBeTruthy()
  expect(stageColumn("closed")).toBeTruthy()
  expect(screen.queryByText(SURFACE_COPY.apply.body)).not.toBeInTheDocument()
}

export function stageColumn(id: string) {
  const column = document.querySelector(`[data-stage="${id}"]`)
  expect(column).toBeTruthy()
  return column as HTMLElement
}

export function createDataTransfer() {
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

export function dragCardToStage(cardName: string, stageId: string) {
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

export function dragCardOntoCard(sourceName: string, targetName: string) {
  const source = screen.getByRole("button", { name: new RegExp(sourceName) })
  const target = screen.getByRole("button", { name: new RegExp(targetName) })
  const dataTransfer = createDataTransfer()
  fireEvent.dragStart(source, { dataTransfer })
  fireEvent.drag(source, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
  fireEvent.dragEnd(source, { dataTransfer })
}

export function expectNoVisibleFitScore() {
  expect(screen.queryByText(/Fit score/i)).not.toBeInTheDocument()
  expect(screen.queryByText("/ 100")).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/fit/i)).not.toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\b(48|61|68|74|79)\b/)
}

export async function addJobFromDialog(jobUrl?: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add job" }))
  const dialog = await screen.findByRole("dialog", { name: "Add job" })
  if (jobUrl !== undefined) {
    fireEvent.change(within(dialog).getByLabelText("Job posting URL"), {
      target: { value: jobUrl },
    })
  }
  fireEvent.click(within(dialog).getByRole("button", { name: "Add job" }))
  return dialog
}

export function installApplyTestLifecycle() {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
}
