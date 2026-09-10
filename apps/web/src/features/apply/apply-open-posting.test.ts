import { afterEach, describe, expect, it, vi } from "vitest"

import { copyApplyJobUrl } from "./apply-open-posting.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("copyApplyJobUrl", () => {
  it("copies the posting URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    await expect(
      copyApplyJobUrl("https://careers.example.com/pm-intern")
    ).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith(
      "https://careers.example.com/pm-intern"
    )
  })

  it("honest-fails when the clipboard is blocked", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })

    await expect(
      copyApplyJobUrl("https://careers.example.com/pm-intern")
    ).resolves.toBe(false)
  })
})
