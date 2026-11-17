import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"

import { useShownWhileClosing } from "./paper-library-closing.ts"

describe("useShownWhileClosing", () => {
  it("keeps the last value while a dialog closes and takes the next one", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string | null }) => useShownWhileClosing(value),
      { initialProps: { value: null as string | null } }
    )
    expect(result.current).toBeNull()
    rerender({ value: "My CV" })
    expect(result.current).toBe("My CV")
    rerender({ value: null })
    expect(result.current).toBe("My CV")
    rerender({ value: "Design letter" })
    expect(result.current).toBe("Design letter")
  })
})
