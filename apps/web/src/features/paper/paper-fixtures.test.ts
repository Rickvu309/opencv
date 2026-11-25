// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { defaultCvData } from "./cv-templates/cv-types.ts"
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
    expect(serialized).toContain("you@opencv.me")
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

describe("prefixed-string retirement", () => {
  it("keeps production Paper modules free of cv:v1 / proof:v1 content", () => {
    const sources = [
      "paper-library.tsx",
      "paper-new-dialog.tsx",
      "paper-library-sections.tsx",
      "paper-template-gallery.tsx",
      "paper-templates.ts",
      "paper-share-page.tsx",
      "paper-api.ts",
      "paper-import-input.tsx",
      ...readdirSync(paperRoot).filter((file) =>
        /^paper-editor-.+\.tsx?$/.test(file)
      ),
      ...readdirSync(path.join(paperRoot, "cv-templates"))
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => `cv-templates/${file}`),
    ]
    expect(sources.length).toBeGreaterThan(15)
    for (const file of sources) {
      expect(readFeature(file)).not.toMatch(/cv:v1:|proof:v1:/)
    }
  })
})
