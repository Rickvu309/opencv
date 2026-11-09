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
    source.replace(
      "IN (${published})",
      "IN (SELECT revision FROM paper_package_versions)"
    ),
    source.replace("head.revision !== basedOn", "false"),
    `${source}\ndb.delete(paperPackageVersions)`,
  ])
    assert.ok(detect(mutation).length > 0)
})

test("Word preparation detects writes inside the complete planner", () => {
  const planner = readFileSync(
    new URL("../apps/api/src/paper/package-planner.ts", import.meta.url),
    "utf8"
  )
  const mutation = planner.replace(
    "const revision = randomUUID()",
    "getDb().insert(paperPackageVersions); const revision = randomUUID()"
  )
  assert.notEqual(mutation, planner)
  assert.deepEqual(detect(planner), [])
  assert.deepEqual(
    detect(mutation).map(({ kind }) => kind),
    ["writing-or-unpinned-package-planner"]
  )
})

test("Word preparation detects transactions inside the complete planner", () => {
  const planner = readFileSync(
    new URL("../apps/api/src/paper/package-planner.ts", import.meta.url),
    "utf8"
  )
  const mutation = planner.replace(
    "const revision = randomUUID()",
    "transaction(async () => {}); const revision = randomUUID()"
  )
  assert.notEqual(mutation, planner)
  assert.deepEqual(detect(planner), [])
  assert.deepEqual(
    detect(mutation).map(({ kind }) => kind),
    ["writing-or-unpinned-package-planner"]
  )
})

test("Word imports reject private children at retry and publication", () => {
  const source = readFileSync(
    new URL("../apps/api/src/paper/package-store.ts", import.meta.url),
    "utf8"
  )
  const condition = "version.parentRevision !== null"
  const first = source.indexOf(condition)
  const last = source.lastIndexOf(condition)
  assert.ok(first >= 0 && last > first)
  assert.deepEqual(detect(source), [])
  for (const index of [first, last]) {
    const mutation =
      source.slice(0, index) + "false" + source.slice(index + condition.length)
    assert.deepEqual(
      detect(mutation).map(({ kind }) => kind),
      ["child-import-publisher"]
    )
  }
})

test("legacy uploads publish Word heads through the Catalog executor", () => {
  const http = readFileSync(
    new URL("../apps/api/src/paper/http.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(http, "apps/api/src/paper/http.ts"), [])
  const mistake = `${http}\nimport { publishWordPackage } from "./package-store.js"`
  assert.deepEqual(
    detect(mistake, "apps/api/src/paper/http.ts").map(({ kind }) => kind),
    ["public-head-executor"]
  )
})
