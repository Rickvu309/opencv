import { act, fireEvent, render, screen, cleanup } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { toast, Toaster } from "sonner"

import {
  cleanupSonnerTimers,
  pendingSonnerTimerCount,
} from "./test-resources.ts"

it("recognizes and cancels Sonner's exit timer", async () => {
  render(<Toaster closeButton />)
  act(() => toast.success("Saved", { duration: Infinity }))
  await screen.findByText("Saved")
  fireEvent.click(screen.getByRole("button", { name: "Close toast" }))
  cleanup()

  expect(
    pendingSonnerTimerCount(),
    "Sonner exit timer was not recognized; check its scheduling stack"
  ).toBeGreaterThan(0)
  const clearTimer = vi.spyOn(globalThis, "clearTimeout")
  try {
    await cleanupSonnerTimers()
    expect(
      clearTimer,
      "Sonner exit timer was not canceled during cleanup"
    ).toHaveBeenCalled()
  } finally {
    clearTimer.mockRestore()
  }
})

it("restores the single timer wrapper after fake timers", () => {
  const wrapper = globalThis.setTimeout
  vi.useFakeTimers()
  globalThis.setTimeout(() => {}, 1)
  vi.useRealTimers()

  expect(globalThis.setTimeout).toBe(wrapper)
})
