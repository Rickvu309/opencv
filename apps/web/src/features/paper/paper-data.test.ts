import { describe, expect, it } from "vitest"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"

import {
  defaultCvData,
  parseCvContent,
  serializeCvContent,
} from "./paper-cv-types.ts"
import { seedPaperDocs } from "./paper-data.ts"
import { parseProofContent } from "./paper-proof-types.ts"

describe("Paper seed documents", () => {
  it("belong to the sample author, not the demo persona", () => {
    const docs = seedPaperDocs()
    const serialized = JSON.stringify(docs)

    expect(serialized).not.toMatch(/Eric Nguyen/i)
    expect(serialized).not.toMatch(/\bEric\b/)
    expect(serialized).toContain(SAMPLE_AUTHOR_NAME)
    expect(serialized).toContain("you@openpath.app")
  })

  it("includes a CV, Letters, and Proofs with status", () => {
    const docs = seedPaperDocs()

    expect(docs.map((doc) => doc.type).sort()).toEqual([
      "cv",
      "letter",
      "letter",
      "proof",
      "proof",
    ])
    expect(docs.some((doc) => doc.status === "draft")).toBe(true)
    expect(docs.some((doc) => doc.status === "ready")).toBe(true)
    expect(parseCvContent(docs[0]!.content).name).toBe(SAMPLE_AUTHOR_NAME)
    expect(parseProofContent(docs[2]!.content).title).toMatch(/card resize/i)
  })

  it("uses a supplied profile for seed authorship", () => {
    const docs = seedPaperDocs({
      name: "Minh Le",
      email: "minh@openpath.app",
      avatarSrc: "",
    })
    const serialized = JSON.stringify(docs)

    expect(serialized).toContain("Minh Le")
    expect(serialized).toContain("minh@openpath.app")
    expect(docs[1]!.content).toContain("Best,\nMinh")
    expect(serialized).not.toMatch(/Eric/i)
  })
})

describe("CV content encoding", () => {
  it("round-trips structured CV data", () => {
    const data = defaultCvData()
    const parsed = parseCvContent(serializeCvContent(data))
    expect(parsed).toEqual(data)
  })
})
