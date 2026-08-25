// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { defaultCvData } from "./paper-cv-types.ts"
import { formatPaperUpdated, paperSummary } from "./paper-data.ts"
import { samplePaperDocs } from "@/test/paper-fixtures.ts"

const paperRoot = fileURLToPath(new URL(".", import.meta.url))

function readFeature(rel: string) {
  return readFileSync(path.join(paperRoot, rel), "utf8")
}

describe("Paper fixtures", () => {
  it("belong to the sample author, not the demo persona", () => {
    const docs = samplePaperDocs()
    const serialized = JSON.stringify(docs)

    expect(serialized).not.toMatch(/Eric Nguyen/i)
    expect(serialized).not.toMatch(/\bEric\b/)
    expect(serialized).toContain(SAMPLE_AUTHOR_NAME)
    expect(serialized).toContain("you@openpath.app")
    expect(serialized).not.toMatch(/cv:v1:|proof:v1:/)
  })

  it("includes a CV, Letters, and Proofs with jsonb content", () => {
    const docs = samplePaperDocs()

    expect(docs.map((doc) => doc.kind).sort()).toEqual([
      "cv",
      "letter",
      "letter",
      "proof",
      "proof",
    ])
    expect(docs.some((doc) => doc.status === "draft")).toBe(true)
    expect(docs.some((doc) => doc.status === "ready")).toBe(true)
    expect(docs[0]!.content).toEqual(defaultCvData())
    expect(docs[2]!.content).toEqual(
      expect.objectContaining({ title: expect.stringMatching(/card resize/i) })
    )
  })
})

describe("paper display helpers", () => {
  it("formats recent updates in plain language", () => {
    const now = Date.parse("2026-08-25T12:00:00.000Z")
    expect(formatPaperUpdated("2026-08-25T11:59:30.000Z", now)).toBe("Just now")
    expect(formatPaperUpdated("2026-08-25T11:11:00.000Z", now)).toBe(
      "49 minutes ago"
    )
    expect(formatPaperUpdated("2026-08-24T12:00:00.000Z", now)).toBe(
      "Yesterday"
    )
  })

  it("summarizes counts from live docs", () => {
    const summary = paperSummary(samplePaperDocs())
    expect(summary[0]).toEqual({
      label: "CVs",
      value: "1",
      hint: "1 draft",
    })
    expect(summary[1]).toEqual({
      label: "Letters",
      value: "2",
      hint: "All drafts",
    })
    expect(summary[3]).toEqual({
      label: "Linked to Apply",
      value: "2",
      hint: "Linked to an Opportunity",
    })
  })
})

describe("prefixed-string retirement", () => {
  it("keeps production Paper modules free of cv:v1 / proof:v1 content", () => {
    const sources = [
      "paper-data.ts",
      "paper-cv-types.ts",
      "paper-proof-types.ts",
      "paper-editor.tsx",
      "paper-workspace.tsx",
      "paper-api.ts",
    ]
    for (const file of sources) {
      expect(readFeature(file)).not.toMatch(/cv:v1:|proof:v1:/)
    }
  })
})
