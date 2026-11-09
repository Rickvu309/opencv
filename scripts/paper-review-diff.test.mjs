import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-review-diff.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const clean = `
export const paperReviewReplacementSchema = z
  .object({
    target: z.string().regex(TARGET),
    before: z.string().min(1),
    after: z.string(),
  })
  .strict()
export function paperReviewDiff(review) {
  const parsed = paperReviewReplacementSchema.safeParse({
    target: change.targetId,
    before: change.before,
    after: change.after,
  })
  if (!parsed.success) refuse()
  const replacements = []
  const frozen = Object.freeze(parsed.data)
  return Object.freeze(parsed.data)
  return Object.freeze(replacements)
  return frozen
}
`

test("a private review field fails and the clean projection does not", () => {
  assert.deepEqual(detect(clean, "paper-review-diff.ts"), [])
  assert.deepEqual(detect("export const unrelated = true", "other.ts"), [])
  for (const field of ["handle", "reversal", "packageBytes"]) {
    const mistake = clean.replace(
      "target: change.targetId,",
      `target: change.targetId,\n    ${field}: change.${field},`
    )
    assert.ok(
      detect(mistake, "paper-review-diff.ts").some(
        (item) => item.kind === "private-review-field"
      ),
      field
    )
  }
  assert.ok(
    detect(
      clean.replace(
        `paperReviewReplacementSchema.safeParse({
    target: change.targetId,
    before: change.before,
    after: change.after,
  })`,
        "paperReviewReplacementSchema.safeParse({ ...change })"
      ),
      "paper-review-diff.ts"
    ).some((item) => item.kind === "private-review-field")
  )
  assert.ok(
    detect(
      `${clean}\nfunction approve() { return null }\n`,
      "paper-review-diff.ts"
    ).some((item) => item.kind === "private-review-field")
  )
  assert.ok(
    detect(
      `${clean}\nfunction undo() { return null }\n`,
      "paper-review-diff.ts"
    ).some((item) => item.kind === "private-review-field")
  )
  const domain = read("packages/domain/src/paper-review-diff.ts")
  const api = read("apps/api/src/paper/package-review-diff.ts")
  const entry = read("packages/domain/src/index.ts")
  assert.deepEqual(
    detect(domain, "packages/domain/src/paper-review-diff.ts"),
    []
  )
  assert.deepEqual(detect(api, "apps/api/src/paper/package-review-diff.ts"), [])
  assert.deepEqual(detect(entry, "packages/domain/src/index.ts"), [])
  assert.ok(
    detect(
      domain.replace(
        "target: change.targetId,",
        "target: change.targetId,\n    handle: change.handle,"
      ),
      "paper-review-diff.ts"
    ).some((item) => item.kind === "private-review-field")
  )
  assert.ok(
    detect(
      api.replace(
        "return paperReviewDiff(review)",
        "return { ...review, packageBytes: review.packageBytes }"
      ),
      "package-review-diff.ts"
    ).some((item) => item.kind === "private-review-field")
  )
})
