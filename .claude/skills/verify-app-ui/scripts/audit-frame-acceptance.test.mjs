import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import {
  auditFrameAcceptance,
  frameEvidenceSha256,
} from "./audit-frame-acceptance.mjs"

const release = {
  frames: [
    { id: "app", name: "W6.2 Blank doc" },
    { id: "public", name: "Landing" },
  ],
}
function fixture(run) {
  const base = mkdtempSync(join(process.env.HOME, "tmp", "acceptance-test-"))
  const artifact = (name, content) => {
    const path = join(base, name)
    const bytes = Buffer.from(content)
    writeFileSync(path, bytes)
    return { path, sha256: createHash("sha256").update(bytes).digest("hex") }
  }
  const reference = artifact(
    "reference.png",
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC",
      "base64"
    )
  )
  reference.kind = "provided-photo"
  const actual = artifact(
    "actual.png",
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC",
      "base64"
    )
  )
  const comparison = {
    reference: reference.path,
    actual: actual.path,
    inputHashes: { reference: reference.sha256, actual: actual.sha256 },
    referenceSize: [1, 1],
    actualSize: [1, 1],
    minimum: 95,
    target: 97,
    tolerance: 24,
    passed: true,
    regions: [
      {
        name: "whole-frame",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        pixels: 1,
        detailPixels: 1,
        matchPercent: 97,
        detailMatchPercent: 97,
      },
    ],
  }
  comparison.regions.push({ ...comparison.regions[0], name: "content" })
  const frame = {
    id: "app",
    reference,
    actual,
    source: [artifact("source.tsx", "source fixture")],
    reviews: ["one", "two"].map((reviewer) => ({
      reviewer,
      scope: "full-frame",
      verdict: "PASS",
      report: artifact(
        `${reviewer}.md`,
        `${reviewer} full-frame fixture review`
      ),
    })),
  }
  const audit = (refreshReviews = true) => {
    frame.comparison = artifact("comparison.json", JSON.stringify(comparison))
    if (refreshReviews)
      frame.reviews.forEach((review, index) => {
        review.report = artifact(
          `${index}.json`,
          JSON.stringify({
            reviewer: review.reviewer,
            scope: review.scope,
            verdict: review.verdict,
            role: index === 0 ? "visual" : "behavior-kit",
            evidenceSha256: frameEvidenceSha256(frame, base),
            findings: "Synthetic full-frame review; no runtime fidelity claim.",
          })
        )
      })
    return auditFrameAcceptance(release, { frames: [frame] }, base)
  }
  try {
    run({ base, frame, comparison, audit, artifact })
  } finally {
    rmSync(base, { recursive: true })
  }
}

test("complete synthetic evidence clears the metadata audit", () =>
  fixture(({ audit }) => assert.equal(audit().passed, true)))
test("detail fidelity cannot hide a failing or missing background score", () =>
  fixture(({ comparison, audit }) => {
    for (const score of [10, undefined, 101, NaN]) {
      comparison.regions[0].matchPercent = score
      assert.ok(
        audit().failures.some((failure) =>
          failure.includes("pixel match below")
        )
      )
    }
  }))
test("flat background match cannot replace detail fidelity", () =>
  fixture(({ comparison, audit }) => {
    comparison.regions[0].matchPercent = 97.727006
    comparison.regions[0].detailMatchPercent = 78.123677
    assert.equal(audit().passed, false)
  }))
test("every app frame needs evidence", () =>
  assert.equal(
    auditFrameAcceptance(release, { frames: [] }, ".").passed,
    false
  ))
test("stale source is rejected", () =>
  fixture(({ frame, audit }) => {
    writeFileSync(frame.source[0].path, "changed source")
    assert.ok(
      audit().failures.some((failure) => failure.includes("stale artifact"))
    )
  }))
test("bounded reviews cannot approve a full screen", () =>
  fixture(({ frame, audit }) => {
    frame.reviews[0].scope = "bounded-fix"
    assert.equal(audit().passed, false)
  }))
test("one reviewer twice is insufficient", () =>
  fixture(({ frame, audit }) => {
    frame.reviews[1].reviewer = "one"
    assert.equal(audit().passed, false)
  }))
test("resized references and changed thresholds fail", () =>
  fixture(({ comparison, audit }) => {
    comparison.referenceSize = [2000, 1250]
    comparison.minimum = 80
    assert.equal(audit().passed, false)
  }))
test("a failing named region cannot hide behind a whole-frame pass", () =>
  fixture(({ comparison, audit }) => {
    comparison.regions.push({
      name: "header",
      detailPixels: 10,
      detailMatchPercent: 80,
    })
    assert.equal(audit().passed, false)
  }))

test("empty and marketing-only inventories fail closed", () => {
  for (const frames of [[], [{ id: "public", name: "Landing" }]]) {
    assert.equal(
      auditFrameAcceptance({ frames }, { frames: [] }, ".").passed,
      false
    )
  }
})

test("reviewer identity metadata requires distinct nonempty strings", () => {
  for (const ids of [
    [{}, {}],
    [" ", "two"],
    ["one", " one "],
  ]) {
    fixture(({ frame, audit }) => {
      frame.reviews[0].reviewer = ids[0]
      frame.reviews[1].reviewer = ids[1]
      assert.equal(audit().passed, false)
    })
  }
})

test("detail pixel metadata requires a positive integer count", () => {
  for (const count of [true, "100", 0.5, 0, -1]) {
    fixture(({ comparison, audit }) => {
      comparison.regions[0].detailPixels = count
      assert.equal(audit().passed, false)
    })
  }
})

test("a new screenshot at the same path invalidates the old comparison", () =>
  fixture(({ frame, artifact, audit }) => {
    frame.actual = artifact("actual.png", "new screenshot at same path")
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("comparison input hashes")
      )
    )
  }))

test("refreshed source hashes cannot recycle reviews of the previous source", () =>
  fixture(({ frame, artifact, audit }) => {
    assert.equal(audit().passed, true)
    frame.source[0] = artifact("source.tsx", "changed source with new hash")
    assert.ok(
      audit(false).failures.some((failure) =>
        failure.includes("review evidence differs")
      )
    )
  }))

test("fresh comparison cannot recycle reviews of the previous capture", () =>
  fixture(({ frame, comparison, artifact, audit }) => {
    assert.equal(audit().passed, true)
    frame.actual = artifact("actual.png", "new screenshot")
    comparison.inputHashes.actual = frame.actual.sha256
    assert.ok(
      audit(false).failures.some((failure) =>
        failure.includes("review evidence differs")
      )
    )
  }))

test("a reconstruction cannot certify original-reference parity", () =>
  fixture(({ frame, audit }) => {
    frame.reference.kind = "html-reconstruction"
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("native pen reference required")
      )
    )
  }))

test("a tiny crop named whole-frame cannot certify the viewport", () =>
  fixture(({ comparison, audit }) => {
    Object.assign(comparison.regions[0], { width: 10, height: 10, pixels: 100 })
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("does not cover viewport")
      )
    )
  }))

test("two visual reviewers do not replace behavior and kit review", () =>
  fixture(({ base, frame, artifact, audit }) => {
    assert.equal(audit().passed, true)
    frame.reviews[1].report = artifact(
      "second.json",
      JSON.stringify({
        reviewer: "two",
        scope: "full-frame",
        verdict: "PASS",
        role: "visual",
        evidenceSha256: frameEvidenceSha256(frame, base),
        findings: "Visual only",
      })
    )
    assert.ok(
      audit(false).failures.some((failure) =>
        failure.includes("review coverage required")
      )
    )
  }))

test("plain text masquerading as a PNG fails", () =>
  fixture(({ frame, comparison, artifact, audit }) => {
    frame.actual = artifact("actual.png", "not an image")
    comparison.inputHashes.actual = frame.actual.sha256
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("PNG header/dimensions differ")
      )
    )
  }))

test("claimed dimensions must match the PNG header", () =>
  fixture(({ comparison, audit }) => {
    comparison.referenceSize = [1440, 900]
    comparison.actualSize = [1440, 900]
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("PNG header/dimensions differ")
      )
    )
  }))

test("whole-frame alone does not replace a named detail region", () =>
  fixture(({ comparison, audit }) => {
    comparison.regions.pop()
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("missing named detail region")
      )
    )
  }))

test("named regions require valid viewport bounds and pixel counts", () => {
  for (const patch of [
    { x: -1 },
    { y: 0.5 },
    { width: 0 },
    { width: 2 },
    { pixels: 99 },
    { pixels: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    fixture(({ comparison, audit }) => {
      Object.assign(comparison.regions[1], patch)
      assert.ok(
        audit().failures.some((failure) =>
          failure.includes("invalid region bounds")
        )
      )
    })
  }
})

test("duplicate region names cannot stand in for detail coverage", () =>
  fixture(({ comparison, audit }) => {
    comparison.regions[1].name = "whole-frame"
    assert.equal(audit().passed, false)
  }))

test("an explicit comparator failure cannot pass on high scores", () =>
  fixture(({ comparison, audit }) => {
    comparison.passed = false
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("comparator reports FAIL")
      )
    )
  }))

test("identical reference and runtime bytes fail provenance", () =>
  fixture(({ frame, comparison, audit }) => {
    frame.actual = {
      path: frame.reference.path,
      sha256: frame.reference.sha256,
    }
    comparison.actual = frame.actual.path
    comparison.inputHashes.actual = frame.actual.sha256
    assert.ok(
      audit().failures.some((failure) =>
        failure.includes("bytes are identical")
      )
    )
  }))

test("non-array regions produce a schema error rather than a JSON error", () =>
  fixture(({ comparison, audit }) => {
    comparison.regions = {}
    const result = audit()
    assert.equal(result.passed, false)
    assert.ok(
      result.failures.some((failure) =>
        failure.includes("regions must be an array")
      )
    )
    assert.ok(
      !result.failures.some((failure) =>
        failure.includes("invalid comparison JSON")
      )
    )
  }))
