import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useJobPosting } from "@/features/apply/use-job-posting.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"

const JOB_URL = "https://linkedin.com/jobs/view/123"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup() {
  const card = sampleApplyCards()[0]
  return renderHook(() =>
    useJobPosting({
      card,
      jobUrl: JOB_URL,
      onPatch: vi.fn(),
      onScanned: vi.fn(),
    })
  )
}

describe("useJobPosting copyPosting", () => {
  it("shows copied for two seconds after a successful copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    vi.useFakeTimers()
    const { result } = setup()

    await act(() => result.current.copyPosting())
    expect(writeText).toHaveBeenCalledWith(JOB_URL)
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.copied).toBe(false)
  })

  it("reports the copy error and never shows copied when the clipboard fails", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    const { result } = setup()

    await act(() => result.current.copyPosting())
    expect(result.current.copyError).toBe(
      "Couldn't copy the posting link. Select Source and copy it."
    )
    expect(result.current.copied).toBe(false)
  })
})
