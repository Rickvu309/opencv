import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { EventEmitter } from "node:events"
import {
  cpSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"

import "./catalog-build.integration.mjs"

import { catalog, root } from "./catalog.mjs"
import { discoverCatalog } from "./lib/catalog-discovery.mjs"
import { catalogPlugin, runCatalog, watchCatalog } from "./lib/catalog-dev.mjs"
import { renderCatalog } from "./lib/operation-catalog.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

const declaration = "packages/domain/src/operations/fixture/echo/operation.ts"
const implementation = "apps/api/src/fixture/operations/fixture/echo/server.ts"
const write = (directory, file, content) => {
  mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
  writeFileSync(path.join(directory, file), content)
}
const descriptor = (
  result = "z.object({ count: z.number() })",
  name = "fixture.echo"
) => `
import { z } from "zod"
import { defineOperation } from "../../../operation.js"
export const operation = defineOperation({
  name: ${JSON.stringify(name)}, owner: "fixture", kind: "read", version: 1, description: "Echo", coach: "auto",
  input: z.object({ count: z.number().default(1) }), publicResult: ${result}, dependsOn: () => [],
})
`
const server = `
import { operation } from "@workspace/domain/operations/fixture/echo"
export const implementation = { operation, execute: (input: { count: number }) => input }
throw new Error("Server execution during discovery is forbidden")
`

function workspace(t) {
  const directory = tempDir(t, "catalog-", path.join(homedir(), "tmp"))
  cpSync(
    path.join(root, "packages/domain/src"),
    path.join(directory, "packages/domain/src"),
    { recursive: true }
  )
  mkdirSync(path.join(directory, "apps/api/src"), { recursive: true })
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(directory, "node_modules"),
    "dir"
  )
  symlinkSync(
    path.join(root, "packages/domain/node_modules"),
    path.join(directory, "packages/domain/node_modules"),
    "dir"
  )
  write(
    directory,
    "packages/domain/package.json",
    readFileSync(path.join(root, "packages/domain/package.json"), "utf8")
  )
  mkdirSync(path.join(directory, "apps/api/node_modules/@workspace"), {
    recursive: true,
  })
  symlinkSync(
    path.join(directory, "packages/domain"),
    path.join(directory, "apps/api/node_modules/@workspace/domain"),
    "dir"
  )
  write(directory, "package.json", '{"type":"module"}')
  return directory
}

test("add, rename and delete pairs regenerate deterministically without running implementations", async (t) => {
  const directory = workspace(t)
  await catalog("generate", directory)
  write(directory, declaration, descriptor())
  await assert.rejects(catalog("check", directory), (error) =>
    error.errors.some((entry) => entry.kind === "missing-implementation")
  )
  write(directory, implementation, server)
  await assert.rejects(catalog("check", directory), { kind: "stale-output" })
  const first = await catalog("generate", directory)
  assert.equal(first.count, 1)
  const outputs = Object.keys(renderCatalog(await discoverCatalog(directory)))
  const before = outputs.map((file) => readFileSync(path.join(directory, file)))
  assert.deepEqual(await catalog("generate", directory), first)
  assert.deepEqual(
    outputs.map((file) => readFileSync(path.join(directory, file))),
    before
  )
  await catalog("check", directory)
  const compiler = path.join(root, "node_modules/typescript/bin/tsc")
  const compilerOptions = [
    "--ignoreConfig",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--skipLibCheck",
    "--types",
    "node",
    "--typeRoots",
    path.join(root, "apps/api/node_modules/@types"),
  ]
  execFileSync(
    process.execPath,
    [
      compiler,
      ...compilerOptions,
      "--declaration",
      "--rootDir",
      "packages/domain/src",
      "--outDir",
      "packages/domain/dist",
      "packages/domain/src/index.ts",
    ],
    { cwd: directory, timeout: 30_000, stdio: "pipe", encoding: "utf8" }
  )
  execFileSync(
    process.execPath,
    [
      compiler,
      ...compilerOptions,
      "--noEmit",
      "--rootDir",
      "apps/api/src",
      "apps/api/src/registry/generated/catalog.ts",
    ],
    { cwd: directory, timeout: 30_000, stdio: "pipe", encoding: "utf8" }
  )
  write(
    directory,
    declaration,
    descriptor().replace('description: "Echo"', 'description: "Changed"')
  )
  await assert.rejects(catalog("check", directory), { kind: "stale-output" })
  await catalog("generate", directory)
  renameSync(
    path.join(directory, path.dirname(declaration)),
    path.join(directory, path.dirname(declaration).replace("/echo", "/repeat"))
  )
  await assert.rejects(catalog("check", directory), (error) =>
    error.errors.some((entry) => entry.kind === "orphan-implementation")
  )
  const renamedDeclaration = declaration.replace("/echo/", "/repeat/")
  const renamedServer = implementation.replace("/echo/", "/repeat/")
  renameSync(
    path.join(directory, path.dirname(implementation)),
    path.join(directory, path.dirname(renamedServer))
  )
  write(directory, renamedDeclaration, descriptor(undefined, "fixture.repeat"))
  write(directory, renamedServer, server.replaceAll("/echo", "/repeat"))
  await catalog("generate", directory)
  const browser = readFileSync(path.join(directory, outputs[0]), "utf8")
  assert.match(browser, /fixture.repeat/)
  assert.doesNotMatch(browser, /fixture.echo|Server execution/)
  rmSync(path.join(directory, renamedServer))
  await assert.rejects(catalog("check", directory), (error) =>
    error.errors.some((entry) => entry.kind === "missing-implementation")
  )
  rmSync(path.join(directory, renamedDeclaration))
  await assert.rejects(catalog("check", directory), { kind: "stale-output" })
  assert.equal((await catalog("generate", directory)).count, 0)
})

test("transport exportability rejects unsupported schemas and accepts server-only private schemas", async (t) => {
  const directory = workspace(t)
  write(
    directory,
    implementation,
    `import { z } from "zod"\n${server}\nconst privateReceiptSchema = z.object({ previous: z.date() })\n`
  )
  for (const result of [
    "z.date()",
    "z.string().transform((value) => value.length)",
    "z.custom()",
  ]) {
    write(directory, declaration, descriptor(result))
    await assert.rejects(catalog("generate", directory), (error) =>
      error.errors.some((entry) => entry.kind === "unexportable-schema")
    )
  }
  write(
    directory,
    declaration,
    descriptor().replace(
      "input: z.object({ count: z.number().default(1) })",
      "input: z.date()"
    )
  )
  await assert.rejects(catalog("generate", directory), (error) =>
    error.errors.some((entry) => entry.kind === "unexportable-schema")
  )
  write(directory, declaration, descriptor())
  assert.equal((await catalog("generate", directory)).count, 1)
})

test("browser graph rejects server, generated, dynamic and computed imports before execution", async (t) => {
  const directory = workspace(t)
  write(directory, implementation, server)
  const forbidden = [
    'import "node:fs"',
    'export * from "../../../../../../apps/api/src/fixture/operations/echo/server.js"',
    'void import("node:fs")',
    'const dependsOn = () => import.meta.glob("/apps/api/src/**/*.ts", { eager: true })',
    'const dependsOn = () => import.meta["glob"]("/apps/api/src/**/*.ts")',
    'const dependsOn = () => import.meta.globEager("/apps/api/src/**/*.ts")',
    'const target = "node:fs"; void import(target)',
    'import "@anthropic-ai/sdk"',
    'export { catalog } from "../../../generated/catalog.js"',
  ]
  for (const source of forbidden) {
    write(directory, declaration, `${source}\n${descriptor()}`)
    await assert.rejects(catalog("generate", directory), {
      kind: "browser-import",
    })
  }
  write(directory, declaration, descriptor())
  assert.equal((await catalog("generate", directory)).count, 1)
})

test("generated browser catalogs never bundle API modules through wrapped Vite macros", async (t) => {
  const { build } = await import(
    path.join(root, "apps/web/node_modules/vite/dist/node/index.js")
  )
  const directory = workspace(t)
  const privateFile = "apps/api/src/private.ts"
  const sentinel = "server-private-catalog-sentinel"
  write(
    directory,
    privateFile,
    `export const privateReceipt = ${JSON.stringify(sentinel)}`
  )
  write(directory, implementation, server)
  const bundle = () =>
    build({
      root: directory,
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: path.join(
            directory,
            "packages/domain/src/generated/catalog.ts"
          ),
          preserveEntrySignatures: "strict",
        },
      },
    })
  for (const receiver of [
    "(import.meta)",
    "(import.meta as ImportMeta)",
    "(import.meta!)",
  ]) {
    write(
      directory,
      declaration,
      descriptor().replace(
        "dependsOn: () => []",
        `dependsOn: () => Object.values(${receiver}.glob("/apps/api/src/private.ts", { eager: true })).map((value) => ({ name: value.privateReceipt, coachFloor: "auto" }))`
      )
    )
    let rejection
    let output = []
    try {
      await catalog("generate", directory)
      output = (await bundle()).output
    } catch (error) {
      rejection = error
    }
    assert.deepEqual(
      output.flatMap((chunk) =>
        chunk.type === "chunk"
          ? Object.keys(chunk.modules).filter((file) =>
              file.includes("/apps/api/")
            )
          : []
      ),
      [],
      receiver
    )
    assert.ok(
      output.every(
        (chunk) => chunk.type !== "chunk" || !chunk.code.includes(sentinel)
      ),
      receiver
    )
    assert.match(rejection?.message ?? "", /browser-import/, receiver)
  }
  write(
    directory,
    declaration,
    `${descriptor()}\nexport const metadata = () => [import.meta.env.PROD, import.meta.url]`
  )
  await catalog("generate", directory)
  const safe = await bundle()
  assert.ok(
    safe.output.every(
      (chunk) => chunk.type !== "chunk" || !chunk.code.includes(sentinel)
    )
  )
})

test("build and dev entry paths reject stale output before launching consumers", async (t) => {
  const directory = workspace(t)
  await catalog("generate", directory)
  write(directory, declaration, descriptor())
  write(directory, implementation, server)
  assert.throws(() => runCatalog("check", directory), /stale-output/)
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts/catalog.mjs"),
          "dev",
          "--root",
          directory,
          "--",
          process.execPath,
          "-e",
          "process.exit(99)",
        ],
        { timeout: 30_000, encoding: "utf8", stdio: "pipe" }
      ),
    /stale-output/
  )
  assert.throws(() => catalogPlugin(directory).buildStart(), /stale-output/)
  await catalog("generate", directory)
  assert.doesNotThrow(() => catalogPlugin(directory).buildStart())
  const rootScripts = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8")
  ).scripts
  assert.match(
    rootScripts.build,
    /^node scripts\/catalog.mjs check && turbo build$/
  )
  for (const pkg of ["packages/domain", "apps/api"]) {
    const scripts = JSON.parse(
      readFileSync(path.join(root, pkg, "package.json"), "utf8")
    ).scripts
    assert.match(
      scripts.build,
      /^node ..\/..\/scripts\/catalog.mjs check && tsc/
    )
  }
})

test(
  "development watches add, delete and rename without polling",
  { timeout: 30_000 },
  async (t) => {
    const directory = workspace(t)
    await catalog("generate", directory)
    const events = new EventEmitter()
    const close = watchCatalog(directory, (error, result) =>
      events.emit("result", error, result)
    )
    t.after(close)
    const next = (predicate, action) =>
      new Promise((resolve) => {
        const listener = (error, result) => {
          if (!predicate(error, result)) return
          events.off("result", listener)
          resolve()
        }
        events.on("result", listener)
        action()
      })
    await next(
      (error) => Boolean(error),
      () => write(directory, declaration, descriptor())
    )
    await next(
      (error, result) => !error && JSON.parse(result).count === 1,
      () => write(directory, implementation, server)
    )
    await next(
      (error) => Boolean(error),
      () =>
        renameSync(
          path.join(directory, declaration),
          path.join(
            directory,
            declaration.replace("operation.ts", "renamed.ts")
          )
        )
    )
    await next(
      (error, result) => !error && JSON.parse(result).count === 1,
      () =>
        renameSync(
          path.join(
            directory,
            declaration.replace("operation.ts", "renamed.ts")
          ),
          path.join(directory, declaration)
        )
    )
    await next(
      (error) => Boolean(error),
      () =>
        renameSync(
          path.join(directory, "apps/api/src/fixture"),
          path.join(directory, "apps/api/src/renamed-owner")
        )
    )
    await next(
      (error, result) => !error && JSON.parse(result).count === 1,
      () =>
        renameSync(
          path.join(directory, "apps/api/src/renamed-owner"),
          path.join(directory, "apps/api/src/fixture")
        )
    )
    await next(
      (error) => Boolean(error),
      () => rmSync(path.join(directory, implementation))
    )
    await next(
      (error, result) => !error && JSON.parse(result).count === 0,
      () => rmSync(path.join(directory, declaration))
    )
    close()
  }
)

test(
  "browser dev refuses invalid pairs and resumes serving after regeneration",
  { timeout: 30_000 },
  async (t) => {
    const directory = workspace(t)
    await catalog("generate", directory)
    const events = new EventEmitter()
    const httpServer = new EventEmitter()
    let middleware
    catalogPlugin(directory).configureServer({
      httpServer,
      ws: { send: (message) => events.emit("message", message) },
      middlewares: {
        use: (handler) => {
          middleware = handler
        },
      },
    })
    t.after(() => httpServer.emit("close"))
    const next = (type, action) =>
      new Promise((resolve) => {
        const listener = (message) => {
          if (message.type !== type) return
          events.off("message", listener)
          resolve(message)
        }
        events.on("message", listener)
        action()
      })
    await next("error", () => write(directory, declaration, descriptor()))
    const response = {
      statusCode: 200,
      end(body) {
        this.body = body
      },
    }
    middleware({}, response, () => assert.fail("invalid catalog served"))
    assert.equal(response.statusCode, 503)
    assert.match(response.body, /missing-implementation/)
    await next("full-reload", () => write(directory, implementation, server))
    let served = false
    middleware({}, response, () => {
      served = true
    })
    assert.equal(served, true)
  }
)

test(
  "API dev stops the consumer on invalid pairs and restarts it after regeneration",
  { timeout: 30_000 },
  async (t) => {
    const directory = workspace(t)
    await catalog("generate", directory)
    const consumer =
      'process.stdout.write("consumer-started\\n"); process.on("SIGTERM", () => { process.stdout.write("consumer-stopped\\n"); process.exit(0) }); process.stdin.resume()'
    const child = spawn(
      process.execPath,
      [
        path.join(root, "scripts/catalog.mjs"),
        "dev",
        "--root",
        directory,
        "--",
        process.execPath,
        "-e",
        consumer,
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    )
    t.after(() => child.kill("SIGTERM"))
    const events = new EventEmitter()
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk
      events.emit("output")
    })
    child.stderr.on("data", (chunk) => {
      output += chunk
      events.emit("output")
    })
    const next = (pattern, action = () => {}) =>
      new Promise((resolve) => {
        const listener = () => {
          if (!pattern.test(output)) return
          events.off("output", listener)
          output = ""
          resolve()
        }
        events.on("output", listener)
        action()
        listener()
      })
    await next(/consumer-started/)
    await next(/consumer-stopped/, () =>
      write(directory, declaration, descriptor())
    )
    await next(/consumer-started/, () =>
      write(directory, implementation, server)
    )
    const exited = new Promise((resolve) => child.once("exit", resolve))
    child.kill("SIGTERM")
    assert.equal(await exited, 143)
  }
)

test("discovery pairs account and chat owners across public namespaces without get collisions", async (t) => {
  const directory = workspace(t)
  for (const [owner, namespace] of [
    ["account", "profile"],
    ["account", "billing"],
    ["chat", "actions"],
    ["chat", "coach"],
  ]) {
    write(
      directory,
      `packages/domain/src/operations/${namespace}/get/operation.ts`,
      descriptor(undefined, `${namespace}.get`).replace(
        'owner: "fixture"',
        `owner: "${owner}"`
      )
    )
    write(
      directory,
      `apps/api/src/${owner}/operations/${namespace}/get/server.ts`,
      server.replaceAll("fixture/echo", `${namespace}/get`)
    )
  }
  assert.equal((await catalog("generate", directory)).count, 4)
  const snapshot = await discoverCatalog(directory)
  assert.deepEqual(
    snapshot.operations
      .map(({ owner, namespace }) => [owner, namespace])
      .sort(),
    [
      ["account", "billing"],
      ["account", "profile"],
      ["chat", "actions"],
      ["chat", "coach"],
    ]
  )
  const generated = readFileSync(
    path.join(directory, "apps/api/src/registry/generated/catalog.ts"),
    "utf8"
  )
  assert.match(generated, /account\/operations\/profile\/get\/server.js/)
  assert.match(generated, /account\/operations\/billing\/get\/server.js/)
})

test("LF and CRLF checkouts emit identical bytes and accept checked-out generated CRLF", async (t) => {
  const directory = workspace(t)
  write(directory, declaration, descriptor())
  write(directory, implementation, server)
  const first = await catalog("generate", directory)
  const snapshot = await discoverCatalog(directory)
  const outputs = Object.keys(renderCatalog(snapshot))
  const bytes = outputs.map((file) => readFileSync(path.join(directory, file)))
  for (const [file, text] of snapshot.sources)
    write(directory, file, text.replaceAll("\n", "\r\n"))
  assert.deepEqual(await discoverCatalog(directory), snapshot)
  assert.deepEqual(await catalog("generate", directory), first)
  assert.deepEqual(
    outputs.map((file) => readFileSync(path.join(directory, file))),
    bytes
  )
  for (const file of outputs)
    write(
      directory,
      file,
      readFileSync(path.join(directory, file), "utf8").replaceAll("\n", "\r\n")
    )
  assert.deepEqual(await catalog("check", directory), first)
  await catalog("generate", directory)
  assert.deepEqual(
    outputs.map((file) => readFileSync(path.join(directory, file))),
    bytes
  )
  for (const file of outputs) rmSync(path.join(directory, file))
  await catalog("generate", directory)
  assert.deepEqual(
    outputs.map((file) => readFileSync(path.join(directory, file))),
    bytes
  )
})
