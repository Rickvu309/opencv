import { describe, expect, it } from "vitest"

import {
  LINK_LABEL_MAX,
  attachmentView,
  linkAttachmentLabel,
} from "./coach-attachment-view.ts"

describe("attachment view", () => {
  it("tells two links from one site apart by path and query", () => {
    const first = linkAttachmentLabel(
      new URL("https://www.jobs.example.com/roles/123/")
    )
    const second = linkAttachmentLabel(
      new URL("https://jobs.example.com/roles/456?ref=mail")
    )
    expect(first).toBe("jobs.example.com/roles/123")
    expect(second).toBe("jobs.example.com/roles/456?ref=mail")
    expect(first).not.toBe(second)
  })

  it("keeps a long link label inside the saved label limit", () => {
    const label = linkAttachmentLabel(
      new URL(`https://example.com/${"a".repeat(400)}`)
    )
    expect(label.length).toBeLessThanOrEqual(LINK_LABEL_MAX)
    expect(label.endsWith("…")).toBe(true)
  })

  it("gives each kind its own place to inspect it", () => {
    expect(attachmentView({ kind: "paper", id: "p1", label: "CV" }).href).toBe(
      "/paper/p1"
    )
    expect(
      attachmentView({ kind: "job", id: "j1", label: "Analyst at Acme" }).href
    ).toBe("/apply/j1")
    const link = attachmentView({
      kind: "link",
      id: "https://example.com/a",
      label: "example.com/a",
    })
    expect(link).toMatchObject({
      href: "https://example.com/a",
      external: true,
      title: "Link: https://example.com/a",
    })
  })
})
