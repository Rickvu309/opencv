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
  detectReplayIdentity,
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
  assert.equal(detectDefinitions(mistake).length, 8)
  assert.deepEqual(detectDefinitions({ ...mistake, operations: [] }), [])
  assert.ok(detectDefinitions(JSON.stringify(mistake)).length > 0)
})

test("G2 exempts only the imported catalog client binding and its actual methods", () => {
  const file = "apps/web/src/features/apply/consumer.ts"
  for (const method of ["run", "options", "useRead", "key"]) {
    const name = method === "run" ? "job.setPriority" : "job.priorityCounts"
    const args = method === "run" ? `"${name}", {}` : `"owner", "${name}", {}`
    for (const text of [
      `import { catalogClient as client } from "@/lib/contract-client"; client.${method}(${args});`,
      `import { catalogClient } from "../../lib/contract-client.js"; catalogClient.${method}(${args});`,
      `import * as contract from "@/lib/contract-client"; contract.catalogClient.${method}(${args});`,
    ])
      assert.deepEqual(
        detectDefinitions({
          operations: clean.operations,
          sources: [[file, text]],
        }),
        [],
        text
      )
    for (const text of [
      `const catalogClient = fake; catalogClient.${method}(${args});`,
      `import { catalogClient } from "./other"; catalogClient.${method}(${args});`,
      `import { other as catalogClient } from "@/lib/contract-client"; catalogClient.${method}(${args});`,
      `import { catalogClient } from "@/lib/contract-client"; function shadow(catalogClient) { catalogClient.${method}(${args}); }`,
      `import * as contract from "@/lib/contract-client"; function shadow(contract) { contract.catalogClient.${method}(${args}); }`,
    ])
      assert.equal(
        detectDefinitions({
          operations: clean.operations,
          sources: [[file, text]],
        }).length,
        1,
        text
      )
  }
  for (const method of ["command", "read"])
    assert.equal(
      detectDefinitions({
        operations: clean.operations,
        sources: [
          [
            file,
            `import { catalogClient } from "@/lib/contract-client"; catalogClient.${method}("job.setPriority", {});`,
          ],
        ],
      }).length,
      1
    )
})

test("G2 replays the existing Job contract as prospective adoption debt and a declaration-free slice stays quiet", () => {
  const file = "packages/domain/src/job-contract.ts"
  const introduced = execFileSync(
    "git",
    [
      "log",
      "--reverse",
      "--format=%H",
      `-S${clean.operations[0].name}`,
      "--",
      file,
    ],
    { cwd: root, encoding: "utf8" }
  )
    .trim()
    .split("\n")[0]
  assert.ok(introduced)
  const before = execFileSync("git", ["show", `${introduced}:${file}`], {
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
    "raw-public-activity",
    "raw-confirmation-receipt",
    "raw-turn-receipt",
    "unguarded-reversal",
  ])
    assert.ok(kinds.includes(kind), kind)
  assert.ok(detectPublication(JSON.stringify(mistake)).length > 0)
  const override = structuredClone(clean)
  override.sources[1][1] = override.sources[1][1].replace(
    "output: this.publicOutput(name, result.output),",
    "output: this.publicOutput(name, result.output), ...result,"
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

test("keyed replay binds stored identity on initial and conflict lookups", () => {
  const before = execFileSync(
    "git",
    [
      "show",
      "63944da863f0f83436305a5a93d9a23303ce8070:apps/api/src/registry/registry.ts",
    ],
    { cwd: root, encoding: "utf8" }
  )
  const now = readFileSync(
    new URL("../apps/api/src/registry/registry.ts", import.meta.url),
    "utf8"
  )
  assert.ok(detectReplayIdentity(before).length)
  assert.deepEqual(detectReplayIdentity(now), [])
  for (const [from, to] of [
    ["stored.command !== command", "false"],
    ["stored.inputHash !== hash", "false"],
    ["stored.inputHash !== null &&", ""],
    ["inputHash(jsonInput(parsed))", "inputHash(options.input)"],
    ["JSON.parse(JSON.stringify(input))", "input"],
    [
      "input.input = jsonInput(parseInput(command.input, input.input))",
      "input.input = input.input",
    ],
    ["parseInput(command.input, options.input)", "options.input"],
    ["inputHash: hash", "inputHash: null"],
    ["hash!", "null"],
  ]) {
    const mutant = now.replace(from, to)
    assert.notEqual(mutant, now)
    assert.ok(detectReplayIdentity(mutant).length, from)
  }
})

test("G3 rejects raw results and reversal inputs in activity, confirmation and turn adapters", () => {
  const file = "apps/api/src/registry/catalog-publication.ts"
  const now = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  for (const [from, to] of [
    ["this.publicOutput(row.command, row.result)", "row.result"],
    ["reversalInput: {}", "reversalInput: row.reversalInput"],
    [
      "? {}\n                    : completed.reversalInput",
      "? completed.reversalInput\n                    : completed.reversalInput",
    ],
    ["receiptDetail(completed.command, completed.result)", "completed.result"],
    ["this.publishResult(receipt.name, receipt.result)", "receipt.result"],
    [
      "this.publishResult(receipt.name, receipt.result)",
      "receipt.reversalInput",
    ],
  ]) {
    const mutant = now.replace(from, to)
    assert.notEqual(mutant, now, from)
    assert.ok(
      detectPublication({ operations: [], sources: [[file, mutant]] }).length,
      from
    )
  }
})

test("G3 requires the kernel call and bounded reversal guard", () => {
  for (const [file, from, to] of [
    [
      "apps/api/src/registry/registry.ts",
      "assertReversal(command.name, this.isCatalogOperation(command.name), ran)",
      "undefined",
    ],
    ["apps/api/src/registry/bind.ts", "catalog ||", "false ||"],
  ]) {
    const now = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    const mutant = now.replace(from, to)
    assert.notEqual(mutant, now)
    assert.ok(
      detectPublication({ operations: [], sources: [[file, mutant]] }).some(
        ({ kind }) => kind === "unguarded-reversal"
      )
    )
  }
})
