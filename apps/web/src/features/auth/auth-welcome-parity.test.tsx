import { afterEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, render, screen } from "@testing-library/react"

import snapshotFile from "./design/w1-5-welcome.snapshot.json"
import { WelcomeScreen } from "./welcome-screen.tsx"

const requestedUrls: string[] = []

function holdEveryApiCallPending() {
  requestedUrls.length = 0
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    requestedUrls.push(String(input instanceof Request ? input.url : input))
    return new Promise<Response>(() => {})
  })
}

function markWelcomedCalls() {
  return requestedUrls.filter((url) => url.endsWith("/profile.markWelcomed"))
    .length
}

function renderWelcome(onDone = () => {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WelcomeScreen onDone={onDone} />
    </QueryClientProvider>
  )
}

type WelcomeSnapshot = { sections: { name: string; texts: string[] }[] }
const snapshot = snapshotFile as WelcomeSnapshot
const penTexts = snapshot.sections.flatMap((section) => section.texts)

function stubMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function steps() {
  return Array.from(document.querySelectorAll("[data-welcome-step]")).map(
    (item) => ({
      text: item.textContent,
      state: item.getAttribute("data-welcome-step"),
    })
  )
}

describe("W1.5 Welcome parity", () => {
  it("shows the frame's texts in order, with the coach step still pending", () => {
    vi.useFakeTimers()
    stubMotion(false)
    holdEveryApiCallPending()
    renderWelcome()

    const shown = [
      screen.getByRole("heading").textContent,
      ...steps().map((step) => step.text),
    ]
    expect(shown).toEqual(penTexts)
    expect(steps().map((step) => step.state)).toEqual([
      "done",
      "done",
      "pending",
    ])
    expect(document.querySelector("[data-welcome-mark]")).not.toBeNull()
    expect(
      document.querySelector(
        '[data-welcome-step="pending"] [data-slot=spinner]'
      )?.classList
    ).toContain("motion-safe:animate-spin")
  })

  it("completes the coach step after the 400ms hold, before it marks welcomed", async () => {
    vi.useFakeTimers()
    stubMotion(false)
    holdEveryApiCallPending()
    renderWelcome()

    await act(() => vi.advanceTimersByTimeAsync(399))
    expect(steps().at(-1)?.state).toBe("pending")
    expect(markWelcomedCalls()).toBe(0)
    await act(() => vi.advanceTimersByTimeAsync(2))
    expect(steps().map((step) => step.state)).toEqual(["done", "done", "done"])
    expect(markWelcomedCalls()).toBe(1)
    expect(
      document.querySelector("[data-welcome-step] [data-slot=spinner]")
    ).toBe(null)
  })

  it("skips the 400ms hold under reduced motion", async () => {
    stubMotion(true)
    holdEveryApiCallPending()
    renderWelcome()
    await vi.waitFor(() => expect(markWelcomedCalls()).toBeGreaterThan(0))
    expect(steps().map((step) => step.state)).toEqual(["done", "done", "done"])
  })

  it("does not mark welcomed or finish after unmount", async () => {
    vi.useFakeTimers()
    stubMotion(false)
    holdEveryApiCallPending()
    const onDone = vi.fn()
    const view = renderWelcome(onDone)
    view.unmount()
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(markWelcomedCalls()).toBe(0)
    expect(onDone).not.toHaveBeenCalled()
  })
})
