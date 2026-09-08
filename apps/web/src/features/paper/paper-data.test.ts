// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  PAPER_CONTENT_VERSION,
  STARTER_CV_NAME,
  starterCvDocument,
  type PaperDoc,
} from "@workspace/domain"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { defaultCvData } from "./paper-cv-types.ts"
import {
  PAPER_ATTACH_CV_CTA,
  PAPER_ATTACH_SAMPLE_CTA,
  PAPER_LINKED_EMPTY_HINT,
  PAPER_LIST_EMPTY_CTA,
  SAMPLE_CV_LABEL,
  formatPaperUpdated,
  isSampleCv,
  paperDocToLink,
  paperLinkedEmptyCta,
  paperSummary,
} from "./paper-data.ts"
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
      id: "cvs",
      label: "CVs",
      value: "1",
      hint: "1 draft",
      cta: null,
    })
    expect(summary[1]).toEqual({
      id: "letters",
      label: "Letters",
      value: "2",
      hint: "All drafts",
      cta: null,
    })
    expect(summary[3]).toEqual({
      id: "linked",
      label: "Linked to Apply",
      value: "2",
      hint: "Linked to an Opportunity",
      cta: null,
    })
  })

  it("labels a lone sample CV and offers one empty-list CTA each", () => {
    const sample = starterSampleCv()
    const summary = paperSummary([sample])

    expect(isSampleCv(sample)).toBe(true)
    expect(paperDocToLink([sample])).toBe(sample)
    expect(summary[0]).toEqual({
      id: "cvs",
      label: "CVs",
      value: "1",
      hint: SAMPLE_CV_LABEL,
      cta: null,
    })
    expect(summary[1]).toEqual({
      id: "letters",
      label: "Letters",
      value: "0",
      hint: "",
      cta: PAPER_LIST_EMPTY_CTA.letter,
    })
    expect(summary[2]).toEqual({
      id: "proof",
      label: "Proof",
      value: "0",
      hint: "",
      cta: PAPER_LIST_EMPTY_CTA.proof,
    })
    expect(summary[3]).toEqual({
      id: "linked",
      label: "Linked to Apply",
      value: "0",
      hint: PAPER_LINKED_EMPTY_HINT,
      cta: PAPER_ATTACH_SAMPLE_CTA,
    })
    expect(paperLinkedEmptyCta([sample])).toBe(PAPER_ATTACH_SAMPLE_CTA)
    expect(summary.map((item) => item.hint).join(" ")).not.toMatch(/None yet/)
    expect(PAPER_LIST_EMPTY_CTA).toEqual({
      letter: "Start letter",
      proof: "Add proof",
      linked: PAPER_ATTACH_SAMPLE_CTA,
    })
    expect(PAPER_ATTACH_SAMPLE_CTA).toBe("Attach Sample CV to a live job")
    expect(PAPER_LINKED_EMPTY_HINT).toMatch(/Apply knows which CV/)
    expect(SAMPLE_CV_LABEL).toBe("Sample · replace anytime")
  })

  it("offers an attach CTA for the first CV when the sample is gone", () => {
    const own: PaperDoc = {
      ...starterSampleCv(),
      id: "77777777-7777-7777-8777-777777777777",
      name: "My internship CV",
    }
    expect(paperLinkedEmptyCta([own])).toBe(PAPER_ATTACH_CV_CTA)
    expect(paperSummary([own])[3]).toMatchObject({
      id: "linked",
      value: "0",
      hint: PAPER_LINKED_EMPTY_HINT,
      cta: PAPER_ATTACH_CV_CTA,
    })
  })

  it("keeps the sample row honest when other CVs exist", () => {
    const sample = starterSampleCv()
    const own: PaperDoc = {
      ...sample,
      id: "77777777-7777-7777-8777-777777777777",
      name: "My internship CV",
    }
    const summary = paperSummary([sample, own])

    expect(isSampleCv(own)).toBe(false)
    expect(summary[0]).toMatchObject({
      id: "cvs",
      value: "2",
      hint: "All drafts",
      cta: null,
    })
  })
})

function starterSampleCv(): PaperDoc {
  return {
    id: "66666666-6666-7666-8666-666666666666",
    name: STARTER_CV_NAME,
    kind: "cv",
    status: "draft",
    content: starterCvDocument(),
    contentVersion: PAPER_CONTENT_VERSION,
    applyCardId: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  }
}

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
