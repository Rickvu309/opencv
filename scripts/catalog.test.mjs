import assert from "node:assert/strict"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { homedir } from "node:os"
import test from "node:test"
import fs from "node:fs"
import childProcess from "node:child_process"
import { syncBuiltinESMExports } from "node:module"
import { catalog, root } from "./catalog.mjs"
import { browserGraph } from "./lib/catalog-discovery.mjs"
import { watchCatalog } from "./lib/catalog-dev.mjs"
import {
  CatalogError,
  detect,
  digestOf,
  renderCatalog,
} from "./lib/operation-catalog.mjs"
import { FAST_GUARDS } from "./ocv-tools/jobs/push-checks.mjs"
import { discoverTests } from "../packages/guards/run-tests.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

const json = (file) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"))
const clean = json("./fixtures/catalog/clean.json")
const mistake = json("./fixtures/catalog/mistake.json")
const declaration = clean.operations[0].file

test("G1 missing pairs, orphans, normalized collisions, namespaces, schemas and stale output fire; a paired catalog stays quiet", () => {
  assert.equal(detect(mistake)[0].kind, "missing-implementation")
  assert.deepEqual(detect(clean, digestOf(clean)), [])
  assert.deepEqual(
    detect(JSON.stringify(clean), "scripts/fixtures/catalog/clean.json"),
    []
  )
  assert.equal(
    detect(JSON.stringify(mistake), "scripts/fixtures/catalog/mistake.json")[0]
      .kind,
    "missing-implementation"
  )
  const fixtures = [
    ["orphan-implementation", { ...clean, operations: [] }],
    [
      "duplicate-name",
      {
        ...clean,
        operations: [
          ...clean.operations,
          { ...clean.operations[0], name: "fixture.eCho" },
        ],
      },
    ],
    [
      "namespace-mismatch",
      {
        ...clean,
        operations: [{ ...clean.operations[0], namespace: "other" }],
      },
    ],
    [
      "namespace-mismatch",
      { ...clean, servers: [{ ...clean.servers[0], namespace: "other" }] },
    ],
    [
      "unexportable-schema",
      {
        ...clean,
        operations: [{ ...clean.operations[0], schemaError: "Date" }],
      },
    ],
    [
      "browser-import",
      {
        ...clean,
        boundaryErrors: [{ file: declaration, detail: "server import" }],
      },
    ],
  ]
  for (const [kind, snapshot] of fixtures) {
    const errors = detect(snapshot)
    assert.ok(
      errors.some(
        (error) => error instanceof CatalogError && error.kind === kind
      ),
      kind
    )
  }
  assert.equal(detect(clean, "stale")[0].kind, "stale-output")
  assert.deepEqual(renderCatalog(clean), renderCatalog(clean))
})

test("the committed browser graph is domain-only and the generated files are fresh", async () => {
  const graph = browserGraph(root, [
    "packages/domain/src/catalog.ts",
    "packages/domain/src/operation.ts",
  ])
  assert.deepEqual(graph.boundaryErrors, [])
  assert.ok(
    graph.sources.every(([file]) => file.startsWith("packages/domain/src/"))
  )
  assert.equal((await catalog("check")).count, 0)
})

test("owners remain independent from profile, billing, actions and coach namespaces", () => {
  for (const [owner, namespace] of [
    ["account", "profile"],
    ["account", "billing"],
    ["chat", "actions"],
    ["chat", "coach"],
  ]) {
    const file = `packages/domain/src/operations/${namespace}/get/operation.ts`
    const operation = {
      file,
      owner,
      name: `${namespace}.get`,
      namespace,
      directory: "get",
    }
    const server = {
      file: `apps/api/src/${owner}/operations/${namespace}/get/server.ts`,
      owner,
      operation: file,
      namespace,
      directory: "get",
    }
    assert.deepEqual(detect({ operations: [operation], servers: [server] }), [])
    for (const change of [
      { owner: "wrong" },
      { namespace: "wrong" },
      { directory: "wrong" },
    ])
      assert.equal(
        detect({
          operations: [operation],
          servers: [{ ...server, ...change }],
        })[0].kind,
        "namespace-mismatch"
      )
  }
})

test("operation declarations reject every import.meta with a file and line", (t) => {
  const directory = tempDir(t, "catalog-meta-", path.join(homedir(), "tmp"))
  const file = path.join(directory, declaration)
  mkdirSync(path.dirname(file), { recursive: true })
  for (const source of mistake.browserSources) {
    writeFileSync(file, `\n${source}`)
    const [error] = browserGraph(directory, [declaration]).boundaryErrors
    assert.deepEqual(
      error,
      {
        file: declaration,
        detail: "line 2: operation declarations must not use import.meta",
      },
      source
    )
    assert.equal(
      detect({ ...clean, browserSources: [source] })[0]?.kind,
      "browser-import",
      source
    )
  }
})

test("pure declarations without import.meta stay browser-discoverable", (t) => {
  const directory = tempDir(t, "catalog-meta-", path.join(homedir(), "tmp"))
  const file = path.join(directory, declaration)
  mkdirSync(path.dirname(file), { recursive: true })
  for (const source of clean.browserSources) {
    writeFileSync(file, source)
    assert.deepEqual(
      browserGraph(directory, [declaration]).boundaryErrors,
      [],
      source
    )
  }
})

test("imported helpers reject import.meta in declarations and callbacks", (t) => {
  const directory = tempDir(
    t,
    "catalog-meta-helper-",
    path.join(homedir(), "tmp")
  )
  const helper = "packages/domain/src/helper.ts"
  const file = path.join(directory, declaration)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, 'export { metadata } from "../../../helper.js"')
  for (const source of [
    ...mistake.browserSources,
    "export const metadata = () => (import.meta as { env: unknown }).env",
  ]) {
    writeFileSync(path.join(directory, helper), `\n${source}`)
    assert.deepEqual(browserGraph(directory, [declaration]).boundaryErrors, [
      {
        file: helper,
        detail: "line 2: operation declarations must not use import.meta",
      },
    ])
  }
})

test("browser source snapshots canonicalize CRLF before hashing", (t) => {
  const directory = tempDir(t, "catalog-crlf-", path.join(homedir(), "tmp"))
  const file = path.join(directory, declaration)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, "export const value = 1\n")
  const lf = browserGraph(directory, [declaration])
  writeFileSync(file, "export const value = 1\r\n")
  assert.deepEqual(browserGraph(directory, [declaration]), lf)
})

test("Turbo compilation always depends on an uncached catalog freshness check", () => {
  const turbo = json("../turbo.json")
  assert.equal(turbo.tasks["//#catalog:check"]?.cache, false)
  for (const task of ["build", "typecheck"])
    assert.ok(turbo.tasks[task].dependsOn.includes("//#catalog:check"), task)
  assert.equal(
    json("../package.json").scripts["catalog:check"],
    "node scripts/catalog.mjs check"
  )
  const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8")
  assert.match(ci, /pnpm exec turbo run lint typecheck build/)
  assert.match(
    ci,
    /pnpm exec turbo run test:open-pr --filter=@workspace\/guards/
  )
  assert.match(
    json("../packages/guards/package.json").scripts["test:open-pr"],
    /catalog.integration.mjs/
  )
})

test("owner directory and unknown watch events rescan once and closing cancels work", (t) => {
  const callbacks = []
  let generated = 0
  let closed = 0
  t.mock.method(fs, "watch", (_directory, _options, callback) => {
    callbacks.push(callback)
    return {
      close: () => {
        closed++
      },
    }
  })
  t.mock.method(childProcess, "execFileSync", () => {
    generated++
    return "generated"
  })
  syncBuiltinESMExports()
  t.after(() => {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  })
  const pending = new Map()
  let sequence = 0
  const timers = {
    start: (callback) => {
      pending.set(++sequence, callback)
      return sequence
    },
    stop: (id) => pending.delete(id),
  }
  const flush = () => {
    const callbacks = [...pending.values()]
    pending.clear()
    callbacks.forEach((callback) => callback())
  }
  const results = []
  const close = watchCatalog(
    root,
    (error, output) => results.push([error, output]),
    timers
  )
  t.after(close)
  callbacks[1]("rename", "account")
  callbacks[1]("rename", "account")
  flush()
  assert.equal(generated, 1)
  assert.deepEqual(results, [[null, "generated"]])
  callbacks[1]("rename", null)
  flush()
  assert.equal(generated, 2)
  callbacks[0]("rename", "operations")
  close()
  flush()
  assert.equal(closed, 2)
  assert.equal(generated, 2)
})

test("compiler and watch integration runs in the existing slow lane, outside fast discovery", () => {
  const slow = "scripts/catalog.integration.mjs"
  assert.ok(FAST_GUARDS.includes("scripts/catalog.test.mjs"))
  assert.ok(!FAST_GUARDS.includes(slow))
  assert.ok(!discoverTests().includes(slow))
  assert.match(
    json("../packages/guards/package.json").scripts["test:open-pr"],
    /node --test ..\/..\/scripts\/catalog.integration.mjs && node run-tests.mjs --open-pr$/
  )
})
