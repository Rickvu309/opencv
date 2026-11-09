import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-publication.mjs"

test("Word library lists fetch only public metadata", () => {
  const mistake = `async function listWordPackages() { return db.select({ version: paperPackageVersions }) }`
  const clean = `async function listWordPackages() { return db.select({ docId: paperPackageVersions.docId, revision: paperPackageVersions.revision, name: paperPackageVersions.name, kind: paperPackageVersions.kind, packageHash: paperPackageVersions.packageHash, byteSize: paperPackageVersions.byteSize }) }`
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    ["whole-package-library-list"]
  )
  assert.deepEqual(detect(clean), [])
  assert.ok(
    detect(`async function listWordPackages() { return db.select() }`).length
  )
  assert.ok(
    detect(
      clean.replace(
        "packageHash: paperPackageVersions.packageHash",
        "packageHash: paperPackageVersions.projection"
      )
    ).length
  )
  const source = readFileSync(
    new URL("../apps/api/src/paper/package-store.ts", import.meta.url),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  const start = source.indexOf(
    "    .select({",
    source.indexOf("export async function listWordPackages")
  )
  const end = source.indexOf("    .from(paperPackageHeads)", start)
  assert.ok(start > 0 && end > start)
  assert.ok(
    detect(
      source.slice(0, start) +
        "    .select({ version: paperPackageVersions })\n" +
        source.slice(end)
    ).length
  )
})
