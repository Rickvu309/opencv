import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { root } from "./catalog.mjs"
import { discoverCatalog } from "./lib/catalog-discovery.mjs"
import {
  detectDefinitions,
  detectPublication,
} from "./lib/catalog-adapters.mjs"

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/catalog-adapters/${name}.json`, import.meta.url),
      "utf8"
    )
  )
const clean = fixture("clean")
const mistake = fixture("mistake")

function sources() {
  return execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/api/src",
      "apps/web/src",
      "packages/domain/src",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(
      (file) =>
        /\.tsx?$/.test(file) && !/\.test\.|\.type-test\.|\/test\//.test(file)
    )
    .map((file) => [
      file,
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    ])
}

test("G2 detects duplicate declarations, bindings, fetchers and keys only for discovered identities", () => {
  assert.deepEqual(detectDefinitions(clean), [])
  assert.equal(detectDefinitions(mistake).length, 4)
  assert.deepEqual(detectDefinitions({ ...mistake, operations: [] }), [])
  assert.ok(detectDefinitions(JSON.stringify(mistake)).length > 0)
})

test("G2 replays the existing Job contract as prospective adoption debt and a declaration-free slice stays quiet", () => {
  const file = "packages/domain/src/job-contract.ts"
  const before = execFileSync("git", ["show", `HEAD:${file}`], {
    cwd: root,
    encoding: "utf8",
  })
  assert.ok(
    detectDefinitions({
      operations: clean.operations,
      sources: [[file, before]],
    }).some((problem) => problem.name === clean.operations[0].name)
  )
  const source = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true)
  const result = ts.transform(source, [
    (context) => {
      const visit = (node) => {
        if (
          ts.isPropertyAssignment(node) &&
          ts.isStringLiteral(node.name) &&
          clean.operations.some(
            (operation) => operation.name === node.name.text
          )
        )
          return undefined
        return ts.visitEachChild(node, visit, context)
      }
      return (node) => ts.visitNode(node, visit)
    },
  ])
  const after = ts.createPrinter().printFile(result.transformed[0])
  assert.deepEqual(
    detectDefinitions({
      operations: clean.operations,
      sources: [[file, after]],
    }),
    []
  )
  result.dispose()
})

test("G3 rejects transitive server imports, raw nested output and private reversal publication", () => {
  assert.deepEqual(detectPublication(clean), [])
  const kinds = detectPublication(mistake).map((problem) => problem.kind)
  for (const kind of [
    "descriptor-foundation",
    "private-import",
    "private-symbol",
    "raw-public-output",
    "private-reversal",
    "raw-public-read",
  ])
    assert.ok(kinds.includes(kind), kind)
  assert.ok(detectPublication(JSON.stringify(mistake)).length > 0)
  const override = structuredClone(clean)
  override.sources[1][1] = override.sources[1][1].replace(
    "output: this.publicOutput(name,result.output),",
    "output: this.publicOutput(name,result.output), ...result,"
  )
  assert.ok(
    detectPublication(override).some(
      (problem) => problem.kind === "raw-public-output"
    )
  )
})

test("the current discovered catalog has disjoint definitions and publication boundaries", async () => {
  const catalog = await discoverCatalog(root)
  const snapshot = { operations: catalog.operations, sources: sources() }
  assert.deepEqual(detectDefinitions(snapshot), [])
  assert.deepEqual(detectPublication(snapshot), [])
})
