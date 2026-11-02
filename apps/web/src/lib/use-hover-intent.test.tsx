import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useHoverIntent } from "@/lib/use-hover-intent.ts"

function Probe() {
  const hover = useHoverIntent({ openDelay: 100, closeDelay: 200 })
  return (
    <div>
      <button {...hover.triggerProps}>trigger</button>
      {hover.open ? <div {...hover.contentProps}>panel</div> : null}
    </div>
  )
}

const mouse = { pointerType: "mouse" }

describe("useHoverIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("opens only after the open delay and not on a quick pass", () => {
    render(<Probe />)
    const trigger = screen.getByText("trigger")
    fireEvent.pointerEnter(trigger, mouse)
    act(() => void vi.advanceTimersByTime(50))
    fireEvent.pointerLeave(trigger, mouse)
    act(() => void vi.advanceTimersByTime(500))
    expect(screen.queryByText("panel")).toBeNull()
    fireEvent.pointerEnter(trigger, mouse)
    act(() => void vi.advanceTimersByTime(100))
    expect(screen.getByText("panel")).toBeTruthy()
  })

  it("closes after a grace and stays open when the pointer returns in time", () => {
    render(<Probe />)
    const trigger = screen.getByText("trigger")
    fireEvent.pointerEnter(trigger, mouse)
    act(() => void vi.advanceTimersByTime(100))
    fireEvent.pointerEnter(screen.getByText("panel"), mouse)
    fireEvent.pointerLeave(screen.getByText("panel"), mouse)
    act(() => void vi.advanceTimersByTime(150))
    fireEvent.pointerEnter(screen.getByText("panel"), mouse)
    act(() => void vi.advanceTimersByTime(500))
    expect(screen.getByText("panel")).toBeTruthy()
    fireEvent.pointerLeave(screen.getByText("panel"), mouse)
    act(() => void vi.advanceTimersByTime(200))
    expect(screen.queryByText("panel")).toBeNull()
  })

  it("closes on its own when the pointer never reaches the panel", () => {
    render(<Probe />)
    fireEvent.pointerEnter(screen.getByText("trigger"), mouse)
    act(() => void vi.advanceTimersByTime(100))
    expect(screen.getByText("panel")).toBeTruthy()
    act(() => void vi.advanceTimersByTime(200))
    expect(screen.queryByText("panel")).toBeNull()
  })

  it("closes on Escape and ignores touch pointers", () => {
    render(<Probe />)
    const trigger = screen.getByText("trigger")
    fireEvent.pointerEnter(trigger, { pointerType: "touch" })
    act(() => void vi.advanceTimersByTime(500))
    expect(screen.queryByText("panel")).toBeNull()
    fireEvent.pointerEnter(trigger, mouse)
    act(() => void vi.advanceTimersByTime(100))
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByText("panel")).toBeNull()
  })
})
