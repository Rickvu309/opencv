// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useReducedMotion } from "./paper-block-field.tsx"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useReducedMotion", () => {
  it("follows a later preference change so a drag does not keep the old motion", () => {
    let onChange: (() => void) | undefined
    const query = {
      matches: false,
      addEventListener: (_name: string, cb: () => void) => {
        onChange = cb
      },
      removeEventListener: () => undefined,
    }
    vi.stubGlobal("matchMedia", () => query)
    const view = renderHook(() => useReducedMotion())
    expect(view.result.current).toBe(false)
    query.matches = true
    act(() => onChange?.())
    expect(view.result.current).toBe(true)
  })
})
