import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-storage.mjs"

test("Paper import tools have a real object root", () => {
  const mistake =
    'defineOperation({ name: "paper.import", input: z.union([legacy, word]).meta({type: "object"}) })'
  const clean =
    'defineOperation({ name: "paper.import", input: z.object({fileId: z.string().optional()}).strict().transform(parse) })'
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    ["nonobject-import-tool-input"]
  )
  assert.deepEqual(detect(clean), [])
  const source = readFileSync(
    new URL(
      "../packages/domain/src/operations/paper/import/operation.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  const mutation = source.replace(
    ".object({",
    ".union([legacy, word]).meta({type: 'object'}).objectFields({"
  )
  assert.notEqual(source, mutation)
  assert.deepEqual(
    detect(mutation).map(({ kind }) => kind),
    ["nonobject-import-tool-input"]
  )
})

test("committed imports release upload cleanup before reading the response", () => {
  const mistake =
    'async function upload() { const imported = await withImportSignal(signal, execute); const document = await registry.read("paper.get"); return document }'
  const clean = mistake.replace(
    "const document",
    "savedId = undefined; const document"
  )
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    ["committed-import-cleanup"]
  )
  assert.deepEqual(detect(clean), [])
  const source = readFileSync(
    new URL("../apps/api/src/paper/http.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source, "http.ts"), [])
})

test("Word library stays absent until the feature read has completed", () => {
  const mistake =
    'function Library() { return !unavailable && owner ? <section aria-label="Word documents">Library</section> : null }'
  const clean = mistake.replace(
    "!unavailable",
    "!unavailable && !library.query.isLoading"
  )
  assert.deepEqual(
    detect(mistake, "library.tsx").map(({ kind }) => kind),
    ["unannounced-word-library"]
  )
  assert.deepEqual(detect(clean, "library.tsx"), [])
  const source = readFileSync(
    new URL(
      "../apps/web/src/features/paper/paper-package-library.tsx",
      import.meta.url
    ),
    "utf8"
  )
  assert.deepEqual(detect(source, "library.tsx"), [])
  const loadingMutation = source.replace("!library.query.isLoading", "true")
  const unavailableMutation = source.replace("!unavailable", "true")
  assert.notEqual(source, loadingMutation)
  assert.notEqual(source, unavailableMutation)
  const unavailableMistake = clean.replace("!unavailable", "true")
  assert.deepEqual(
    detect(loadingMutation, "library.tsx").map(({ kind }) => kind),
    ["unannounced-word-library"]
  )
  assert.deepEqual(
    detect(unavailableMistake, "library.tsx").map(({ kind }) => kind),
    ["unannounced-word-library"]
  )
  assert.deepEqual(
    detect(unavailableMutation, "library.tsx").map(({ kind }) => kind),
    ["unannounced-word-library"]
  )
})

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
    new URL(
      "../apps/api/src/paper/word-package/package-http.ts",
      import.meta.url
    ),
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
    planner.replace("await draftBatch(", "await looseDraft("),
    source.replace(
      "IN (${published})",
      "IN (SELECT revision FROM paper_package_versions)"
    ),
    source.replace("head.revision !== basedOn", "false"),
    `${source}\ndb.delete(paperPackageVersions)`,
  ])
    assert.ok(detect(mutation).length > 0)
  const document = readFileSync(
    new URL(
      "../apps/api/src/paper/word-package/word/document.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.deepEqual(detect(document), [])
  for (const mutation of [
    document.replace(
      "packageDigest(opened.read()) !== version.projectionHash",
      "false"
    ),
    document.replace(
      "const { version, artifact } = await wordPackageBasis(",
      "const { version, artifact } = await latestBasis("
    ),
    document.replace(
      "  if (drafted.refused) return drafted\n  const revision = randomUUID()",
      "  if (drafted.refused) return drafted\n  getDb().insert(paperPackageVersions)\n  const revision = randomUUID()"
    ),
  ]) {
    assert.notEqual(mutation, document)
    assert.ok(detect(mutation).length > 0)
  }
})

test("Word preparation detects writes inside the complete planner", () => {
  const planner = readFileSync(
    new URL("../apps/api/src/paper/package-planner.ts", import.meta.url),
    "utf8"
  )
  const mutation = planner.replace(
    "const drafted = await draftBatch(",
    "getDb().insert(paperPackageVersions)\n  const drafted = await draftBatch("
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
    "const drafted = await draftBatch(",
    "transaction(async () => {})\n  const drafted = await draftBatch("
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
