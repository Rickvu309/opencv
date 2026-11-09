import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-candidate.mjs"

const clean = `
async function prepareStoredWordPackage() {
  if (insideTransaction()) return packageFailure("outside SQL");
  await transaction(async () => {
    const [version] = await db.select().from(paperPackageVersions).where(eq(paperPackageVersions.revision, seal.basis.revision)).for("update");
    const [artifact] = await db.select().from(files).where(eq(files.id, seal.basis.fileId)).for("update");
    if (packageDigest(version) !== packageDigest(basis.version) || archiveDigest(artifact.bytes) !== seal.basis.packageHash) return unavailable();
  });
}
async function retained() {
  if (!insideTransaction()) return packageFailure("inside SQL");
}
async function publish() {
  const changed = await db.update(paperPackageHeads).set({revision: identity.revision}).where(and(
    eq(paperPackageHeads.userId, seal.owner), eq(paperPackageHeads.docId, seal.docId),
    eq(paperPackageHeads.incarnation, seal.incarnation), eq(paperPackageHeads.revision, identity.parentRevision)
  )).returning();
  if (changed.length !== 1) return unavailable();
}`

test("private Word candidates keep preparation outside SQL and publication in exact-head SQL", () => {
  assert.deepEqual(detect(clean), [])
  for (const statement of [
    'if (insideTransaction()) return packageFailure("outside SQL");',
    'if (!insideTransaction()) return packageFailure("inside SQL");',
  ]) {
    assert.deepEqual(
      detect(clean.replace(statement, "")).map(({ kind }) => kind),
      ["candidate-transaction-boundary"]
    )
  }
  for (const field of ["userId", "docId", "incarnation", "revision"]) {
    assert.deepEqual(
      detect(
        clean.replace(`paperPackageHeads.${field}`, "paperPackageHeads.wrong")
      ).map(({ kind }) => kind),
      ["candidate-exact-head-cas"]
    )
  }
  assert.deepEqual(
    detect(clean.replace("changed.length !== 1", "changed.length === 1")).map(
      ({ kind }) => kind
    ),
    ["candidate-exact-head-cas"]
  )
  for (const [before, after] of [
    ['.for("update")', '.for("share")'],
    ["packageDigest(version)", "packageDigest(basis.version)"],
    ["archiveDigest(artifact.bytes)", "seal.basis.packageHash"],
  ]) {
    assert.deepEqual(
      detect(clean.replace(before, after)).map(({ kind }) => kind),
      ["candidate-retention-recheck"]
    )
  }
  const source = readFileSync(
    new URL("../apps/api/src/paper/package-candidates.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  for (const [before, after, kind] of [
    [
      "if (insideTransaction())",
      "if (false)",
      "candidate-transaction-boundary",
    ],
    [
      "if (!insideTransaction())",
      "if (false)",
      "candidate-transaction-boundary",
    ],
    [
      "eq(paperPackageHeads.revision, identity.parentRevision)",
      "eq(paperPackageHeads.revision, identity.revision)",
      "candidate-exact-head-cas",
    ],
    [
      "changed.length !== 1",
      "changed.length === 1",
      "candidate-exact-head-cas",
    ],
    ['.for("update")', '.for("share")', "candidate-retention-recheck"],
    [
      "packageDigest(version) !== packageDigest(basis.version)",
      "false",
      "candidate-retention-recheck",
    ],
    [
      "archiveDigest(artifact.bytes) !== seal.basis.packageHash",
      "false",
      "candidate-retention-recheck",
    ],
  ]) {
    assert.ok(source.includes(before))
    assert.ok(
      detect(source.replace(before, after)).some(
        (problem) => problem.kind === kind
      )
    )
  }
})
