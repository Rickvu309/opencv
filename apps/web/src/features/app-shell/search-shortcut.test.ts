import { describe, expect, it } from "vitest"

import {
  isApplePlatform,
  searchShortcutLabel,
} from "@/features/app-shell/search-shortcut.ts"

describe("search shortcut label", () => {
  it("uses the command key on Apple keyboards and Ctrl K elsewhere", () => {
    expect(searchShortcutLabel(true)).toBe("⌘K")
    expect(searchShortcutLabel(false)).toBe("Ctrl K")
  })

  it("reads the platform from userAgentData first, then navigator.platform", () => {
    expect(
      isApplePlatform({
        userAgentData: { platform: "macOS" },
        platform: "",
      } as never)
    ).toBe(true)
    expect(isApplePlatform({ platform: "MacIntel" } as never)).toBe(true)
    expect(isApplePlatform({ platform: "iPhone" } as never)).toBe(true)
    expect(isApplePlatform({ platform: "Linux x86_64" } as never)).toBe(false)
    expect(
      isApplePlatform({
        userAgentData: { platform: "Windows" },
        platform: "MacIntel",
      } as never)
    ).toBe(false)
  })
})
