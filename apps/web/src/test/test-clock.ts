import { vi } from "vitest"

export const TEST_NOW = new Date("2026-10-29T05:00:00.000Z")

export function pinTestClock(): void {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(TEST_NOW)
}
