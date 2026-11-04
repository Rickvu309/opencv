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
  it("edits the tour CV header through paper.edit", () => {
    expect(tour).toContain('commandPath("paper.edit")')
    expect(tour).toContain("name: 'Live Check'")
    expect(tour).toContain("op: 'setHeader'")
    expect(tour).toContain("email: 'tour@verify.local'")
  })
})
