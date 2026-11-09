import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-storage.mjs"

test("immutable Word storage rejects unfinished heads, projection shadows and flattening", () => {
  const mistake = `
    async function stageWordPackage() { return parseImportFile(bytes) }
    async function publishWordPackage() { return db.insert(paperPackageHeads) }
    async function readWordPackage() { return PaperPackage.open(bytes) }
    async function exportWordPackage() { return mammoth.extractRawText(bytes) }
    db.update(paperPackageVersions)
    uniqueIndex("paper_package_identity_idx").on(docId, userId, incarnation, revision)
  `
  const clean = `
    async function stageWordPackage() { await PaperPackage.open(bytes); return transaction(save) }
    async function publishWordPackage() { return transaction(async () => { if (version.parentRevision !== null) throw Error(); await completeVersion(version); return db.insert(paperPackageHeads) }) }
    async function readWordPackage() { return completeVersion(await ownedVersion(owner, docId, at)) }
    async function exportWordPackage() { return completeVersion(await ownedVersion(owner, docId, at)) }
  `
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    [
      "flattened-or-published-stage",
      "flattened-package",
      "child-import-publisher",
      "unfinished-package-head",
      "mutable-read-projection",
      "mutable-read-projection",
      "flattened-package",
      "mutable-package-version",
      "late-package-identity-constraint",
    ]
  )
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(
    detect(
      'unique("paper_package_identity_idx").on(docId, userId, incarnation, revision)'
    ),
    []
  )
  const schema = readFileSync(
    new URL("../apps/api/src/db/paper-package-schema.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(schema), [])
  assert.ok(
    detect(
      schema.replace(
        'unique("paper_package_identity_idx")',
        'uniqueIndex("paper_package_identity_idx")'
      )
    ).length > 0
  )
  const source = readFileSync(
    new URL("../apps/api/src/paper/package-store.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  for (const mutation of [
    source.replace(
      "await completeVersion(version)",
      "await Promise.resolve(version)"
    ),
    source.replace(
      "await PaperPackage.open(bytes, context)",
      "await parseImportFile(bytes, context)"
    ),
    source.replace(
      "const version = await ownedVersion(owner, docId, at)",
      "const version = await latestVersion(owner, docId)"
    ),
    `${source}\ndb.update(paperPackageVersions)`,
  ])
    assert.ok(detect(mutation).length > 0)
  const http = readFileSync(
    new URL("../apps/api/src/paper/package-http.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(http, "package-http.ts"), [])
  assert.ok(
    detect(
      'import { publishWordPackage } from "./package-store.js"',
      "package-http.ts"
    ).length > 0
  )
  const planner = readFileSync(
    new URL("../apps/api/src/paper/package-planner.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(planner), [])
  for (const mutation of [
    planner.replace("insideTransaction()", "false"),
    planner.replace("await wordPackageBasis(", "await latestBasis("),
    `${planner}\nasync function prepareWordPackage() { return db.insert(paperPackageVersions) }`,
    source.replace(
      "IN (${published})",
      "IN (SELECT revision FROM paper_package_versions)"
    ),
    source.replace("head.revision !== basedOn", "false"),
    source.replaceAll("version.parentRevision !== null", "false"),
    `${source}\ndb.delete(paperPackageVersions)`,
  ])
    assert.ok(detect(mutation).length > 0)
})
