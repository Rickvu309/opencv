import { act, fireEvent, render, screen, cleanup } from "@testing-library/react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { toast, Toaster } from "sonner"

beforeAll(() => vi.useFakeTimers())
afterAll(() => vi.useRealTimers())

it("leaves Sonner's exit timer for the shared teardown to cancel", async () => {
  render(<Toaster closeButton />)
  act(() => {
    toast.success("Saved", { duration: Infinity })
    vi.advanceTimersByTime(0)
  })
  fireEvent.click(screen.getByRole("button", { name: "Close toast" }))
  cleanup()
  // Sonner 2.0.8 deleteToast schedules a 200ms callback with no effect cleanup.
  expect(vi.getTimerCount()).toBeGreaterThan(0)
})

it("starts the next test without a callback retaining the unmounted Toaster", async () => {
  expect(vi.getTimerCount()).toBe(0)
  await act(async () => vi.advanceTimersByTimeAsync(200))
  expect(vi.getTimerCount()).toBe(0)
})
