import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8")
}

describe("apply dialogs centre on the content column", () => {
  it("uses one anchor rule and does not measure the shell", () => {
    const rule = source("./apply-column-anchor.css")
    const anchor = source("./apply-column-anchor.tsx")
    const created = source("./apply-new-job-dialog.tsx")
    const deleted = source("./apply-job-delete-dialog.tsx")
    expect(rule).toContain("anchor-name: --apply-column")
    expect(rule).toContain("left: anchor(center)")
    expect(rule).toContain('[data-slot="new-job-dialog"]')
    expect(rule).toContain('[data-slot="confirm-delete"]')
    expect(anchor).toContain('data-slot="apply-column-anchor"')
    for (const file of [created, deleted, anchor, rule]) {
      expect(file).not.toContain("app-main")
      expect(file).not.toContain("118px")
      expect(file).not.toContain("ResizeObserver")
      expect(file).not.toContain("useState")
    }
    expect(created).toContain("<ApplyColumnAnchor />")
    expect(deleted).toContain("<ApplyColumnAnchor />")
  })
})
