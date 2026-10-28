// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  PAPER_CONTENT_VERSION,
  STARTER_CV_NAME,
  type PaperDoc,
} from "@workspace/domain"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { defaultCvData } from "./paper-cv-types.ts"
import {
  PAPER_ATTACH_CV_CTA,
  PAPER_ATTACH_SAMPLE_CTA,
  PAPER_LINKED_EMPTY_HINT,
  PAPER_ZERO_STATES,
  OWNED_CV_NAME,
  SAMPLE_CV_LABEL,
  SAMPLE_CV_MAKE_MINE,
  formatPaperUpdated,
  isSampleCv,
  cvContentOf,
  isStarterCvPersonName,
  ownedCvName,
  paperDocToLink,
  paperLinkedEmptyCta,
  paperZeroStates,
} from "./paper-data.ts"
import { samplePaperDocs } from "@/test/paper-fixtures.ts"
import { starterCvDocument } from "@/test/starter-cv.ts"

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

  it("offers no prompt when every kind exists and a doc is linked", () => {
    expect(paperZeroStates(samplePaperDocs(), true)).toEqual([])
  })

  it("labels a lone sample CV and offers one prompt per missing kind", () => {
    const sample = starterSampleCv()
    const states = paperZeroStates([sample], true)

    expect(isSampleCv(sample)).toBe(true)
    expect(paperDocToLink([sample])).toBe(sample)
    expect(states).toEqual([
      { id: "letter", ...PAPER_ZERO_STATES.letter },
      { id: "proof", ...PAPER_ZERO_STATES.proof },
      {
        id: "linked",
        title: PAPER_ATTACH_SAMPLE_CTA,
        hint: PAPER_LINKED_EMPTY_HINT,
      },
    ])
    expect(paperLinkedEmptyCta([sample])).toBe(PAPER_ATTACH_SAMPLE_CTA)
    expect(PAPER_ATTACH_SAMPLE_CTA).toBe("Attach Sample CV to a Job")
    expect(PAPER_LINKED_EMPTY_HINT).toMatch(/Apply knows which CV/)
    expect(SAMPLE_CV_LABEL).toBe("Sample · replace anytime")
    expect(SAMPLE_CV_MAKE_MINE).toBe("Make mine")
  })

  it("offers a CV prompt first on an empty drive and no link without a card", () => {
    expect(paperZeroStates([], true).map((state) => state.id)).toEqual([
      "cv",
      "letter",
      "proof",
    ])
    expect(
      paperZeroStates([starterSampleCv()], false).map((state) => state.id)
    ).toEqual(["letter", "proof"])
  })

  it("names a claimed sample CV after the person on the page, then the User", () => {
    expect(isStarterCvPersonName("Your name")).toBe(true)
    expect(ownedCvName("Alex Tran")).toBe("Alex's CV")
    expect(ownedCvName("Alex Tran", "Your name")).toBe("Alex's CV")
    expect(ownedCvName("Alex Tran", "Linh Nguyen")).toBe("Linh's CV")
    expect(ownedCvName(undefined, "  ")).toBe(OWNED_CV_NAME)
    expect(ownedCvName("  ")).toBe(OWNED_CV_NAME)
  })

  it("offers an attach prompt for the first CV when the sample is gone", () => {
    const own: PaperDoc = {
      ...starterSampleCv(),
      id: "77777777-7777-7777-8777-777777777777",
      name: "My internship CV",
    }
    expect(paperLinkedEmptyCta([own])).toBe(PAPER_ATTACH_CV_CTA)
    expect(paperZeroStates([own], true).at(-1)).toEqual({
      id: "linked",
      title: PAPER_ATTACH_CV_CTA,
      hint: PAPER_LINKED_EMPTY_HINT,
    })
  })

  it("shows the legacy Your name placeholder as an empty name", () => {
    const sample = starterSampleCv()
    const legacy: PaperDoc = {
      ...sample,
      content: { ...(sample.content as object), name: "Your name" },
    }
    expect(cvContentOf(legacy).name).toBe("")
    expect(cvContentOf(sample).name).toBe("")
    const own: PaperDoc = {
      ...sample,
      content: { ...(sample.content as object), name: "Linh Nguyen" },
    }
    expect(cvContentOf(own).name).toBe("Linh Nguyen")
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
      "paper-library.tsx",
      "paper-letter.tsx",
      "paper-new-dialog.tsx",
      "paper-parts.tsx",
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
