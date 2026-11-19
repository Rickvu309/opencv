import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  CATCH_UP_WORDS,
  WORD_PACE_MS,
  revealStep,
  useSmoothText,
  wordEnds,
} from "./use-smooth-text.ts"

describe("revealStep", () => {
  it("ends every step on a whole word", () => {
    expect(wordEnds("Lead with the result")).toEqual([5, 10, 14, 20])
  })

  it("shows one word per pace when little is waiting", () => {
    const text = "Lead with the result"
    expect(revealStep({ length: 0, credit: 0 }, text, WORD_PACE_MS)).toEqual({
      length: 5,
      credit: 0,
    })
    expect(
      revealStep({ length: 0, credit: 0 }, text, WORD_PACE_MS / 2).length
    ).toBe(0)
  })

  it("speeds up when a large burst arrives so it never lags the network", () => {
    const burst = Array.from({ length: 40 }, (_, n) => `word${n}`).join(" ")
    const step = revealStep({ length: 0, credit: 0 }, burst, WORD_PACE_MS)
    const shownWords = burst.slice(0, step.length).trim().split(" ").length
    expect(shownWords).toBe(40 / CATCH_UP_WORDS)
  })

  it("never passes the text it was given", () => {
    expect(revealStep({ length: 12, credit: 0 }, "Short", 100)).toEqual({
      length: 5,
      credit: 0,
    })
  })
})

function Probe({ text }: { text: string }) {
  return <p data-testid="probe">{useSmoothText(text)}</p>
}

let frames: FrameRequestCallback[] = []
let clock = 0

function runFrame(step = WORD_PACE_MS) {
  clock += step
  const due = frames
  frames = []
  act(() => due.forEach((callback) => callback(clock)))
}

function motionPreference(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

beforeEach(() => {
  frames = []
  clock = 0
  motionPreference(false)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("useSmoothText", () => {
  it("writes a reply in word by word instead of all at once", () => {
    const text = "Lead with the outcome, then the numbers that prove it."
    const view = render(<Probe text={text} />)
    const probe = view.getByTestId("probe")
    expect(probe.textContent).toBe("")

    runFrame()
    runFrame()
    const first = probe.textContent ?? ""
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThan(text.length)
    expect(text.startsWith(first)).toBe(true)
    expect(first.endsWith(" ")).toBe(true)

    for (let frame = 0; frame < 60 && frames.length; frame++) runFrame()
    expect(probe.textContent).toBe(text)
  })

  it("keeps what is shown when more text streams in", () => {
    const view = render(<Probe text="Tighten" />)
    for (let frame = 0; frame < 10 && frames.length; frame++) runFrame()
    expect(view.getByTestId("probe").textContent).toBe("Tighten")

    view.rerender(<Probe text="Tighten the summary." />)
    expect(view.getByTestId("probe").textContent).toBe("Tighten")
    for (let frame = 0; frame < 10 && frames.length; frame++) runFrame()
    expect(view.getByTestId("probe").textContent).toBe("Tighten the summary.")
  })

  it("shows the whole text at once when motion is reduced", () => {
    motionPreference(true)
    const view = render(<Probe text="All of it now." />)
    expect(view.getByTestId("probe").textContent).toBe("All of it now.")
  })
})
