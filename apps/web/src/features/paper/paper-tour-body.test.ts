import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const tour = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../../.claude/skills/verify-app-ui/scripts/lib/tour.mjs"
  ),
  "utf8"
)

describe("verify-app-ui tour body", () => {
  it("replaces the tour CV with a version 2 document", () => {
    expect(tour).toContain("version: 2")
    expect(tour).toContain("name: 'Live Check'")
    expect(tour).toContain("type: 'heading'")
    expect(tour).toContain("text: 'Product intern'")
    expect(tour).toContain("text: 'A CV created for this check.'")
    expect(tour).toContain("type: 'experience-entry'")
    expect(tour).toContain("role: 'Intern'")
    expect(tour).toContain("company: 'Lab'")
    expect(tour).toContain("period: '2025'")
    expect(tour).toContain("text: 'Shipped a small study.'")
  })
})
