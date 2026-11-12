import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { css as segmentedControlCss } from "./components/segmented-control-styles"
import { css as toolCallCardCss } from "./components/tool-call-card-styles"
import { CommentThread } from "./components/comment-thread"
import { FilterMenu } from "./components/filter-menu"
import { NumberTicker } from "./components/number-ticker"
import { SegmentedControl } from "./components/segmented-control"
import { ShimmerText } from "./components/shimmer-loader"
import { ThinkingLoader } from "./components/thinking-loader"
import { ToolCallCard } from "./components/tool-call-card"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const OPTIONS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
]

function stubResizeObserver() {
  const observers: Array<() => void> = []
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observers.push(callback)
      }
      observe() {}
      disconnect() {}
    }
  )
  return observers
}

function optionButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".ui-segc__opt"))
}

describe("segmented control", () => {
  it("moves and selects with the arrow keys, Home and End", async () => {
    stubResizeObserver()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <SegmentedControl
        options={OPTIONS}
        defaultValue="a"
        onChange={onChange}
      />
    )
    optionButtons(container)[0].focus()
    await user.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenLastCalledWith("b")
    await user.keyboard("{End}")
    expect(onChange).toHaveBeenLastCalledWith("c")
    await user.keyboard("{Home}")
    expect(onChange).toHaveBeenLastCalledWith("a")
  })

  it("picks from a keyboard or screen reader click, since pointers are handled on the track", async () => {
    stubResizeObserver()
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <SegmentedControl
        options={OPTIONS}
        defaultValue="a"
        onChange={onChange}
      />
    )
    optionButtons(container)[2].focus()
    await user.keyboard("{Enter}")
    expect(onChange).toHaveBeenLastCalledWith("c")
    optionButtons(container)[1].focus()
    await user.keyboard(" ")
    expect(onChange).toHaveBeenLastCalledWith("b")
  })

  it("re-measures one frame after the resize observer fires, so setting widths never loops it", () => {
    const observers = stubResizeObserver()
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => {
      frames.push(frame)
      return frames.length
    })
    const measuring = vi.spyOn(window, "getComputedStyle")
    render(<SegmentedControl options={OPTIONS} defaultValue="a" />)
    const measuredOnMount = measuring.mock.calls.length
    observers.forEach((notify) => notify())
    expect(measuring.mock.calls.length).toBe(measuredOnMount)
    frames.splice(0).forEach((frame) => frame(0))
    expect(measuring.mock.calls.length).toBeGreaterThan(measuredOnMount)
  })

  it("lets a mouse press pick at once but a touch pick only on lift", () => {
    stubResizeObserver()
    const onChange = vi.fn()
    const { container } = render(
      <SegmentedControl
        options={OPTIONS}
        defaultValue="a"
        onChange={onChange}
      />
    )
    optionButtons(container).forEach((button, index) => {
      vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
        left: index * 100,
        right: index * 100 + 100,
      } as DOMRect)
    })
    const track = container.querySelector(".ui-segc__track") as HTMLElement
    const press = { button: 0, clientX: 250, pointerId: 1 }
    fireEvent.pointerDown(track, { ...press, pointerType: "touch" })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(track, { ...press, pointerType: "touch" })
    expect(onChange).toHaveBeenCalledWith("c")
    onChange.mockClear()
    fireEvent.pointerDown(track, {
      ...press,
      clientX: 50,
      pointerId: 2,
      pointerType: "mouse",
    })
    expect(onChange).toHaveBeenCalledWith("a")
  })

  it("keeps drags horizontal and lets a scrolling control scroll both ways", () => {
    expect(segmentedControlCss).toContain("touch-action: pan-y;")
    expect(segmentedControlCss).toContain("touch-action: pan-x pan-y;")
  })
})

describe("filter menu keyboard", () => {
  const groups = [
    {
      id: "stage",
      label: "Stage",
      options: [
        { id: "applied", label: "Applied" },
        { id: "offer", label: "Offer" },
      ],
    },
    { id: "remote", label: "Remote", options: [{ id: "yes", label: "Yes" }] },
  ]

  it("moves with the arrows, picks with Enter and Space, and folds a group with the left and right arrows", async () => {
    stubResizeObserver()
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FilterMenu groups={groups} onChange={onChange} />)
    const stage = screen.getByRole("button", { name: /Stage/ })
    stage.focus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("checkbox", { name: "Applied" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onChange).toHaveBeenLastCalledWith({ stage: ["applied"] })
    await user.keyboard("{ArrowDown} ")
    expect(onChange).toHaveBeenLastCalledWith({
      stage: ["applied", "offer"],
    })
    await user.keyboard("{ArrowLeft}")
    expect(stage).toHaveAttribute("aria-expanded", "false")
    expect(stage).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(stage).toHaveAttribute("aria-expanded", "true")
    await user.keyboard("{ArrowDown}{ArrowUp}")
    expect(stage).toHaveFocus()
  })
})

describe("number ticker", () => {
  it("keys digits from the right so the ones column keeps its identity when the number grows", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }))
    const columns = (container: HTMLElement) =>
      Array.from(container.querySelectorAll(".ui-nt__col"))
    const { container, rerender } = render(<NumberTicker value={99} />)
    const onesBefore = columns(container).at(-1)
    rerender(<NumberTicker value={100} />)
    expect(columns(container)).toHaveLength(3)
    expect(columns(container).at(-1)).toBe(onesBefore)
  })
})

describe("units in prop names", () => {
  it("takes shimmer text duration in seconds", () => {
    render(<ShimmerText durationSeconds={3}>Thinking</ShimmerText>)
    expect(screen.getByText("Thinking")).toHaveStyle({
      animationDuration: "3s",
    })
  })

  it("takes the tool call duration in milliseconds", () => {
    render(<ToolCallCard name="search" status="success" durationMs={2500} />)
    expect(screen.getByText(/2\.5\s*s/)).toBeInTheDocument()
  })
})

describe("thinking loader", () => {
  it("sizes the label box from offsetWidth, which ignores zoom and transforms, plus one pixel", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 50,
    } as DOMRect)
    const { container } = render(<ThinkingLoader />)
    expect(
      container.querySelector<HTMLElement>(".ui-tlc__text")?.style.width
    ).toBe("101px")
  })
})

describe("kit styles", () => {
  it("draws tool call card strokes as half-pixel inset shadows", () => {
    expect(toolCallCardCss).toContain("inset 0 0 0 0.5px var(--ui-tcc-line)")
  })

  it("grows a tool call body from zero to one fraction so the height animates without measuring", () => {
    expect(toolCallCardCss).toContain("grid-template-rows: 0fr;")
    expect(toolCallCardCss).toContain("grid-template-rows: 1fr;")
  })

  it("keeps the comment thread's buttons at margin zero and its text fields free of a focus box", () => {
    stubResizeObserver()
    Element.prototype.scrollTo = vi.fn()
    render(<CommentThread messages={[]} currentUser={{ name: "Ada" }} />)
    const styles = document.head.textContent ?? ""
    expect(styles).toContain(".ui-ct button { margin: 0;")
    expect(styles).toContain(".ui-ct textarea:focus-visible,")
    expect(styles).toMatch(
      /\[contenteditable\]:focus-visible \{ outline: none; \}/
    )
  })
})
