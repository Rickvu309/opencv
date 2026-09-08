// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  PAPER_CONTENT_VERSION,
  STARTER_CV_NAME,
  STARTER_GUIDED_APPLY_COMPANY,
  STARTER_GUIDED_APPLY_TITLE,
  starterCvDocument,
  type PaperDoc,
} from "@workspace/domain"

import { sampleApplyCards } from "@/test/apply-fixtures.ts"

import { paperAttachPair, paperDocsLinkedToCard } from "./paper-apply-attach.ts"
import {
  PAPER_ATTACH_CV_CTA,
  PAPER_ATTACH_SAMPLE_CTA,
  PAPER_LINKED_EMPTY_HINT,
  paperLinkedEmptyCta,
} from "./paper-data.ts"

function sampleCv(): PaperDoc {
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

function ownCv(): PaperDoc {
  return {
    ...sampleCv(),
    id: "77777777-7777-7777-8777-777777777777",
    name: "My internship CV",
  }
}

describe("Paper ↔ Apply attach path", () => {
  it("names one café CTA and attaches the sample CV to the seeded job", () => {
    const doc = sampleCv()
    const cards = sampleApplyCards()
    const pair = paperAttachPair([doc], cards)

    expect(PAPER_LINKED_EMPTY_HINT).toBe(
      "So Apply knows which CV goes with a job."
    )
    expect(paperLinkedEmptyCta([doc])).toBe(PAPER_ATTACH_SAMPLE_CTA)
    expect(PAPER_ATTACH_SAMPLE_CTA).toBe("Attach Sample CV to a live job")
    expect(pair?.doc).toBe(doc)
    expect(pair?.card.title).toBe(STARTER_GUIDED_APPLY_TITLE)
    expect(pair?.card.company).toBe(STARTER_GUIDED_APPLY_COMPANY)
    expect(pair?.card.stage).toBe("inbox")
    expect(paperDocsLinkedToCard([doc], pair!.card.id)).toEqual([])
  })

  it("falls back to the first CV when the sample is gone", () => {
    const doc = ownCv()
    const cards = sampleApplyCards()
    const pair = paperAttachPair([doc], cards)

    expect(paperLinkedEmptyCta([doc])).toBe(PAPER_ATTACH_CV_CTA)
    expect(PAPER_ATTACH_CV_CTA).toBe("Attach CV to a live job")
    expect(pair?.doc).toBe(doc)
    expect(pair?.card.title).toBe(STARTER_GUIDED_APPLY_TITLE)
  })

  it("does not invent a job or a doc", () => {
    expect(paperLinkedEmptyCta([])).toBeNull()
    expect(paperAttachPair([], sampleApplyCards())).toBeNull()
    expect(paperAttachPair([sampleCv()], [])).toBeNull()
    expect(
      paperAttachPair(
        [sampleCv()],
        sampleApplyCards().filter((card) => card.stage === "sent")
      )
    ).toBeNull()
  })
})
