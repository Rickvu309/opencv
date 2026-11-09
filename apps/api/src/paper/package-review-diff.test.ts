import { describe, expect, it } from "vitest"

import {
  packageReviewDiff,
  type PaperReviewReplacement,
} from "./package-review-diff.js"

const target = `t_${"ab".repeat(32)}`

describe("packageReviewDiff", () => {
  it("returns the frozen words and does not approve or undo", () => {
    const diff = packageReviewDiff({
      docId: "6d2f0a4e-1c7b-4a1e-9b3a-6f0c1d2e3a4b",
      basedOn: "7e3a1b5f-2d8c-4b2f-8c4b-7a1d2e3f4b5c",
      handle: "sentinel-handle",
      reversal: { marker: "reversal-sentinel" },
      packageBytes: "package-byte-sentinel",
      changes: [
        {
          targetId: target,
          before: "Ada",
          after: "Grace",
          handle: "sentinel-handle",
          reversal: { marker: "reversal-sentinel" },
          packageBytes: "package-byte-sentinel",
          location: { paragraph: 0, kind: "paragraph" },
        },
      ],
    })
    expect(diff).toEqual([{ target, before: "Ada", after: "Grace" }])
    expect(JSON.stringify(diff)).not.toContain("sentinel")
    const shown: PaperReviewReplacement = {
      target,
      before: "Ada",
      after: "Grace",
      // @ts-expect-error a private handle is not a review word
      handle: "sentinel-handle",
    }
    expect(shown.before).toBe("Ada")
    const row = diff[0]
    if (!row) throw new Error("missing replacement")
    // @ts-expect-error a reversal is not a review word
    void row.reversal
    // @ts-expect-error package bytes are not a review word
    void row.packageBytes
  })
})
