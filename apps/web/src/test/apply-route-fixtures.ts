import { afterEach, beforeEach, expect, vi } from "vitest"
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
  expect(screen.getByRole("radio", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Calendar" })).toBeInTheDocument()
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

let restoreObserver: typeof ResizeObserver | null = null

const STAGE_IDS = ["inbox", "prep", "sent", "live", "closed"]

/**
 * jsdom has no layout, and dnd-kit moves by measured rectangles. Lay the
 * columns out side by side and stack each column's cards so the keyboard
 * sensor can find its neighbours. The drag overlay sits where the held card is.
 */
export function layoutBoard() {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  // dnd-kit measures a node when its ResizeObserver first reports it.
  restoreObserver = window.ResizeObserver
  window.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      queueMicrotask(() =>
        this.callback(
          [
            { target, contentRect: target.getBoundingClientRect() },
          ] as ResizeObserverEntry[],
          this as unknown as ResizeObserver
        )
      )
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const column = this.closest("[data-stage]")
      if (!column) {
        const held = document.activeElement?.closest("[data-card-id]")
        const overlay = this.closest("[style*='position: fixed']")
        return overlay && held ? held.getBoundingClientRect() : rect(0, 0, 0, 0)
      }
      const x = STAGE_IDS.indexOf(column.getAttribute("data-stage")!) * 200
      if (this === column) return rect(x, 0, 190, 600)
      const card = this.closest("[data-card-id]")
      if (card !== this) return rect(0, 0, 0, 0)
      const index = [...column.querySelectorAll("[data-card-id]")].indexOf(card)
      return rect(x + 5, 60 + index * 90, 180, 80)
    }
  )
}

export function boardCard(name: string | RegExp) {
  return screen.getByRole("button", { name })
}

/** Pick a card up with Space, press the arrow keys, and drop it with Space. */
export async function moveCardByKeyboard(
  user: ReturnType<typeof userEvent.setup>,
  name: string | RegExp,
  arrows: string[]
) {
  act(() => boardCard(name).focus())
  await user.keyboard(" ")
  for (const arrow of arrows) await user.keyboard(`{${arrow}}`)
  await user.keyboard(" ")
}

export function expectNoVisibleFitScore() {
  expect(screen.queryByText(/Fit score/i)).not.toBeInTheDocument()
  expect(screen.queryByText("/ 100")).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/fit/i)).not.toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/\b(48|61|68|74|79)\b/)
}

export async function addJobFromDialog(jobUrl?: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add opportunity" }))
  const dialog = await screen.findByRole("dialog", { name: "Add opportunity" })
  if (jobUrl !== undefined) {
    fireEvent.change(within(dialog).getByLabelText("Posting link"), {
      target: { value: jobUrl },
    })
  }
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Add opportunity" })
  )
  return dialog
}

export function installApplyTestLifecycle() {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (restoreObserver) window.ResizeObserver = restoreObserver
    restoreObserver = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
}
