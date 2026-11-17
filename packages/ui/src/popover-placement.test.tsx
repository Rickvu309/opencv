import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Popover, PopoverContent, PopoverTrigger } from "./components/popover"
import { popoverAlignment, popoverCoordinate } from "./lib/popover-alignment"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const placement = {
  align: "start",
  start: 192,
  anchorSize: 88,
  popupSize: 224,
  viewportStart: 0,
  viewportSize: 390,
  offset: 0,
  padding: 8,
  reverse: false,
} satisfies Parameters<typeof popoverAlignment>[0]

it.each([
  [52.5, 1, 53],
  [99.5, 1, 100],
  [294.5, 1, 295],
  [50.5, 1, 51],
  [52.5, 2, 52.5],
])("snaps coordinate %s at pixel ratio %s", (position, ratio, expected) => {
  expect(popoverCoordinate(position, ratio)).toBe(expected)
})

it.each([1440, 1024, 820, 390])(
  "keeps New job Location anchored at viewport %i",
  (viewportSize) => {
    const align = popoverAlignment({ ...placement, viewportSize })
    expect(align).toBe(viewportSize === 390 ? "end" : "start")
    const x =
      align === "start"
        ? placement.start
        : placement.start + placement.anchorSize - placement.popupSize
    expect(x).toBe(viewportSize === 390 ? 56 : 192)
    expect(x + placement.popupSize).toBeLessThanOrEqual(viewportSize - 8)
  }
)

it("flips end alignment near the leading edge", () => {
  expect(popoverAlignment({ ...placement, align: "end", start: 12 })).toBe(
    "start"
  )
})

it("keeps centered placement and leaves shifting to the SDK", () => {
  expect(popoverAlignment({ ...placement, align: "center" })).toBe("center")
})

it("flips logical alignment for right-to-left triggers", () => {
  expect(popoverAlignment({ ...placement, reverse: true, start: 12 })).toBe(
    "end"
  )
})

it("accounts for alignment offset and a zoomed viewport", () => {
  expect(
    popoverAlignment({
      ...placement,
      start: 102,
      viewportStart: 100,
      viewportSize: 260,
      offset: 10,
    })
  ).toBe("start")
})

it("keeps the popup outside caller style ancestry", async () => {
  render(
    <div data-testid="coach-header" style={{ color: "rgb(89, 89, 91)" }}>
      <Popover>
        <PopoverTrigger>History</PopoverTrigger>
        <PopoverContent>
          <button>New chat</button>
        </PopoverContent>
      </Popover>
    </div>
  )
  fireEvent.click(screen.getByRole("button", { name: "History" }))
  const popup = await screen.findByRole("dialog", { name: "History" })
  expect(popup.parentElement).toBe(document.body)
  expect(screen.getByTestId("coach-header").contains(popup)).toBe(false)
  popup.style.top = "294.5px"
  await waitFor(() => expect(popup.style.top).toBe("295px"))
})
