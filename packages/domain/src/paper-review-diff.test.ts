import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { paperReviewDiff } from "./paper-review-diff.ts"

const target = `t_${"ab".repeat(32)}`
const other = `t_${"cd".repeat(32)}`

function change(
  id: string,
  before: string,
  after: string,
  extra?: Record<string, unknown>
) {
  return {
    targetId: id,
    before,
    after,
    location: { paragraph: 1, kind: "paragraph" },
    formatting: { kind: "inherited", scope: "preserved-uncomputed" },
    context: { paragraphText: before },
    ...extra,
  }
}

function review(changes: unknown[], extra?: Record<string, unknown>) {
  return {
    docId: "6d2f0a4e-1c7b-4a1e-9b3a-6f0c1d2e3a4b",
    basedOn: "7e3a1b5f-2d8c-4b2f-8c4b-7a1d2e3f4b5c",
    changes,
    ...extra,
  }
}

const leaked = review(
  [
    change(target, "Ada", "Grace", {
      handle: "sentinel-handle",
      reversal: { command: "paper.restoreWord", marker: "reversal-sentinel" },
      packageBytes: "package-byte-sentinel",
    }),
  ],
  {
    handle: "sentinel-handle",
    reversal: { marker: "reversal-sentinel" },
    packageBytes: "package-byte-sentinel",
    bytes: "package-byte-sentinel",
  }
)

describe("paperReviewDiff", () => {
  it("keeps the frozen replacements and nothing else", () => {
    const diff = paperReviewDiff(leaked)
    assert.deepEqual(diff, [{ target, before: "Ada", after: "Grace" }])
    assert.deepEqual(Object.keys(diff[0] ?? {}), ["target", "before", "after"])
    const text = JSON.stringify(diff)
    assert.equal(text.includes("sentinel-handle"), false)
    assert.equal(text.includes("reversal-sentinel"), false)
    assert.equal(text.includes("package-byte-sentinel"), false)
    assert.equal(text.includes("restoreWord"), false)
    assert.equal(JSON.stringify(paperReviewDiff(leaked)), text)
    assert.throws(() => {
      diff[0]!.before = "Bob"
    })
  })

  it("keeps replacement order", () => {
    const diff = paperReviewDiff(
      review([change(target, "Ada", "Grace"), change(other, "Lin", "Mai")])
    )
    assert.deepEqual(
      diff.map((row) => row.target),
      [target, other]
    )
  })

  it("allows an empty after and an empty change list", () => {
    assert.deepEqual(paperReviewDiff(review([])), [])
    assert.deepEqual(paperReviewDiff(review([change(target, "Ada", "")])), [
      { target, before: "Ada", after: "" },
    ])
  })

  it("refuses a private payload, a duplicate, and a bad replacement", () => {
    assert.throws(
      () =>
        paperReviewDiff({
          handle: "sentinel-handle",
          reversal: { marker: "reversal-sentinel" },
          packageBytes: "package-byte-sentinel",
        }),
      /This Word review is unavailable/
    )
    assert.throws(
      () =>
        paperReviewDiff(
          review([change(target, "Ada", "Grace"), change(target, "Ada", "Ida")])
        ),
      /unavailable/
    )
    assert.throws(
      () => paperReviewDiff(review([change("target", "Ada", "Grace")])),
      /unavailable/
    )
    assert.throws(
      () => paperReviewDiff(review([change(target, "", "Grace")])),
      /unavailable/
    )
    assert.throws(
      () =>
        paperReviewDiff(
          review([change(target, "a".repeat(8 * 1024 + 1), "b")])
        ),
      /unavailable/
    )
    assert.throws(
      () => paperReviewDiff(review(Array.from({ length: 21 }, () => ({})))),
      /unavailable/
    )
  })
})
