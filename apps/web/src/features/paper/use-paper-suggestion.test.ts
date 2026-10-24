// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { DiffHunk } from "@workspace/domain"

import { usePaperSuggestion } from "./use-paper-suggestion.ts"

const hunk = { section: "Summary", sectionId: "summary" } as DiffHunk

describe("usePaperSuggestion", () => {
  it("keeps the first previous content and records the decision", () => {
    const { result } = renderHook(() => usePaperSuggestion())
    act(() => result.current.add({ v: 1 }, [hunk]))
    act(() => result.current.add({ v: 2 }, [hunk]))
    expect(result.current.suggestion?.previous).toEqual({ v: 1 })
    let undone: unknown
    act(() => {
      undone = result.current.undo()
    })
    expect(undone).toMatchObject({ previous: { v: 1 } })
    expect(result.current.suggestion).toBeNull()
    expect(result.current.log).toMatchObject([{ outcome: "undone" }])
  })

  it("returns null when there is nothing to decide", () => {
    const { result } = renderHook(() => usePaperSuggestion())
    expect(result.current.keep()).toBeNull()
    expect(result.current.log).toEqual([])
  })

  it("clears the log only when asked", () => {
    const { result } = renderHook(() => usePaperSuggestion())
    act(() => result.current.add({}, [hunk]))
    act(() => {
      result.current.keep()
    })
    act(() => result.current.clear())
    expect(result.current.log).toHaveLength(1)
    act(() => result.current.clear(true))
    expect(result.current.log).toEqual([])
  })
})
