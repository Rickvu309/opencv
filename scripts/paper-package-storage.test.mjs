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
