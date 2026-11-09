import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-retention.mjs"

const clean = `
const retentionLimits = { count: 64, bytes: 64 * 1024 * 1024 }
async function requireCandidateCapacity(owner, packageBytes, material) {
  const [account] = await db.select().from(user).where(eq(user.id, owner)).for("no key update")
  if (!account) return unavailable()
  const usage = db.select({count: count(), bytes: sql\`sum(
    \${forward.byteSize} + \${restore.byteSize} + \${paperPackageCandidates.seal}
    + \${forward.sidecar} + \${forward.projection} + \${restore.sidecar} + \${restore.projection})
    + \${packageBytes} + \${JSON.stringify(material)}\`})
    .from(paperPackageCandidates).where(eq(paperPackageCandidates.userId, owner))
  if (!usage || usage.count >= retentionLimits.count || usage.bytes > retentionLimits.bytes)
    return packageFailure("full")
}
async function prepareStoredWordPackage() {
  await transaction(async () => {
    await requireCandidateCapacity(owner, bytes, material)
    await db.insert(paperPackageCandidates).values(candidate)
  })
}`

const mistakes = [
  ['.for("no key update")', '.for("share")', "candidate-retention-owner-lock"],
  [
    "usage.count >= retentionLimits.count",
    "false",
    "candidate-retention-capacity",
  ],
  [
    "usage.bytes > retentionLimits.bytes",
    "false",
    "candidate-retention-capacity",
  ],
  ["forward.projection", "forward.wrong", "candidate-retention-capacity"],
  [
    "usage.bytes > retentionLimits.bytes",
    "true && usage.bytes > retentionLimits.bytes",
    "candidate-retention-capacity",
  ],
  [
    "eq(paperPackageCandidates.userId, owner)",
    "eq(paperPackageCandidates.userId, other)",
    "candidate-retention-capacity",
  ],
  [
    "await requireCandidateCapacity(",
    "requireCandidateCapacity(",
    "candidate-retention-before-insert",
  ],
  ["count: 64", "count: 65", "candidate-retention-capacity"],
]

test("candidate retention bounds owner-serialized storage before writes", () => {
  assert.deepEqual(detect(clean), [])
  for (const [before, after, kind] of mistakes) {
    assert.ok(clean.includes(before))
    assert.ok(
      detect(clean.replace(before, after)).some(
        (problem) => problem.kind === kind
      )
    )
  }
  assert.deepEqual(detect("export const unrelated = true"), [])
  assert.deepEqual(detect("async function prepareStoredWordPackage() {}"), [
    { kind: "candidate-retention-capacity", line: 1 },
  ])
  const source = readFileSync(
    new URL("../apps/api/src/paper/package-candidates.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  for (const [before, after, kind] of mistakes) {
    const actual = before
    const changed = source.replace(actual, after)
    assert.notEqual(changed, source)
    assert.ok(detect(changed).some((problem) => problem.kind === kind))
  }
})
