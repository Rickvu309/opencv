import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useFlash } from "./use-flash.ts"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("useFlash", () => {
  it("is false until triggered", () => {
    const { result } = renderHook(() => useFlash(2000))

    expect(result.current[0]).toBe(false)
  })

  it("is true right after trigger and false after ms", () => {
    const { result } = renderHook(() => useFlash(2000))

    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)

    act(() => vi.advanceTimersByTime(1999))
    expect(result.current[0]).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe(false)
  })

  it("restarts the timer on a second trigger", () => {
    const { result } = renderHook(() => useFlash(2000))

    act(() => result.current[1]())
    act(() => vi.advanceTimersByTime(1500))
    act(() => result.current[1]())
    act(() => vi.advanceTimersByTime(1500))
    expect(result.current[0]).toBe(true)

    act(() => vi.advanceTimersByTime(500))
    expect(result.current[0]).toBe(false)
  })

  it("clears the timer on unmount without a state update", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useFlash(2000))

    act(() => result.current[1]())
    unmount()

    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(5000))
    expect(error).not.toHaveBeenCalled()
  })
})
