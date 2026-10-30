import { expect, test } from "vitest"
import { quarantine } from "../../vitest.quarantine"

test("quarantined tests have an owner issue, reason and a valid future expiry", () => {
  const today = new Date().toISOString().slice(0, 10)
  for (const entry of quarantine) {
    expect(entry.file.trim()).not.toBe("")
    expect(entry.file).not.toBe("src/test/quarantine-expiry.test.ts")
    expect(entry.reason.trim()).not.toBe("")
    expect(entry.issue.trim()).not.toBe("")
    expect(entry.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(entry.expires).toISOString().slice(0, 10)).toBe(
      entry.expires
    )
    expect(
      entry.expires >= today,
      `${entry.file} expired: ${entry.issue}`
    ).toBe(true)
  }
})
