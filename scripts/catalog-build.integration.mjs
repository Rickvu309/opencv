import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs"
import { homedir } from "node:os"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"

import { buildBrowserCatalog, catalog, root } from "./catalog.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

test("descriptor names, wire inputs, resource callbacks and public results infer without casts", () => {
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--skipLibCheck",
      "--types",
      "node",
      "--typeRoots",
      "./apps/api/node_modules/@types",
      "packages/domain/src/operation.test.ts",
    ],
    { cwd: root, timeout: 30_000, encoding: "utf8", stdio: "pipe" }
  )
})

const declaration = "packages/domain/src/operations/fixture/echo/operation.ts"
const implementation = "apps/api/src/fixture/operations/fixture/echo/server.ts"
const write = (directory, file, content) => {
  mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
  writeFileSync(path.join(directory, file), content)
}

test("Turbo catalog hashes ignore unrelated API tests and include each catalog input", (t) => {
  const directory = tempDir(t, "catalog-turbo-", path.join(homedir(), "tmp"))
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  })
    .split("\0")
    .filter(Boolean)
  for (const file of tracked) {
    if (!existsSync(path.join(root, file))) continue
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    cpSync(path.join(root, file), path.join(directory, file))
  }
  const hashes = () => {
    const result = JSON.parse(
      execFileSync(
        path.join(root, "node_modules/.bin/turbo"),
        [
          "run",
          "typecheck",
          "build",
          "--filter=web",
          "--filter=api",
          "--filter=@workspace/domain",
          "--dry=json",
          "--daemon=false",
        ],
        { cwd: directory, encoding: "utf8", stdio: "pipe", timeout: 30_000 }
      )
    )
    return Object.fromEntries(
      result.tasks
        .filter(
          (task) =>
            task.taskId === "//#catalog:check" ||
            /^(web|@workspace\/(domain|ui))#(build|typecheck)$/.test(
              task.taskId
            )
        )
        .map((task) => [task.taskId, task.hash])
    )
  }
  const baseline = hashes()
  for (const task of [
    "//#catalog:check",
    "@workspace/domain#build",
    "@workspace/domain#typecheck",
    "web#build",
    "web#typecheck",
  ])
    assert.ok(baseline[task], task)
  const unrelated = "apps/api/src/registry/catalog.test.ts"
  const original = readFileSync(path.join(directory, unrelated), "utf8")
  write(directory, unrelated, `${original}\n`)
  assert.deepEqual(hashes(), baseline, unrelated)
  write(directory, unrelated, original)
  for (const file of [
    declaration,
    implementation,
    "packages/domain/src/operation.ts",
    "packages/domain/src/generated/catalog.ts",
    "packages/domain/src/generated/catalog.digest",
    "apps/api/src/registry/generated/catalog.ts",
    "scripts/catalog.mjs",
    ...tracked.filter(
      (file) => file.startsWith("scripts/lib/catalog-") && file.endsWith(".mjs")
    ),
    "scripts/lib/operation-catalog.mjs",
    "scripts/lib/source-imports.mjs",
  ]) {
    const target = path.join(directory, file)
    const previous = existsSync(target)
      ? readFileSync(target, "utf8")
      : undefined
    write(directory, file, `${previous ?? ""}\n`)
    const changed = hashes()
    for (const task of Object.keys(baseline))
      assert.notEqual(changed[task], baseline[task], `${file}: ${task}`)
    if (previous === undefined) rmSync(target)
    else write(directory, file, previous)
  }
})

const descriptor = () => `
import { z } from "zod"
import { defineOperation } from "../../../operation.js"
export const operation = defineOperation({
  name: "fixture.echo", owner: "fixture", kind: "read", version: 1, description: "Echo", coach: "auto",
  input: z.object({}), publicResult: z.object({}), dependsOn: () => [],
})
`
const server =
  'import { operation } from "@workspace/domain/operations/fixture/echo"; export const implementation = { operation, execute: async () => ({}) }'

function browserWorkspace(t) {
  const directory = tempDir(t, "catalog-backstop-", path.join(homedir(), "tmp"))
  cpSync(
    path.join(root, "packages/domain/src"),
    path.join(directory, "packages/domain/src"),
    { recursive: true }
  )
  mkdirSync(path.join(directory, "apps/web"), { recursive: true })
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
  write(directory, "package.json", '{"type":"module"}')
  write(
    directory,
    "packages/domain/package.json",
    readFileSync(path.join(root, "packages/domain/package.json"), "utf8")
  )
  return directory
}

test("kind-based Vite backstop rejects every review probe without discovery", async (t) => {
  const fixtures = JSON.parse(
    readFileSync(
      path.join(root, "scripts/fixtures/catalog/mistake.json"),
      "utf8"
    )
  )
  for (const fixture of fixtures.importCases.filter(
    (entry) => !entry.discoveryOnly
  )) {
    await t.test(fixture.name, async (t) => {
      let directory = browserWorkspace(t)
      write(directory, implementation, server)
      write(directory, declaration, descriptor())
      await catalog("generate", directory)
      if (fixture.packageRoot) {
        const seed = directory
        directory = browserWorkspace(t)
        cpSync(
          path.join(seed, "packages/domain/src/generated"),
          path.join(directory, "packages/domain/src/generated"),
          { recursive: true }
        )
      }
      write(
        directory,
        "apps/api/src/private.ts",
        'export const secret = "private-api-sentinel"'
      )
      write(
        directory,
        "apps/api/src/private.css",
        ".private-api-sentinel{color:red}"
      )
      write(
        directory,
        "apps/api/src/private.svg",
        '<svg xmlns="http://www.w3.org/2000/svg"><text>private-api-sentinel</text></svg>'
      )
      write(
        directory,
        "apps/api/src/private-large.txt",
        "private-api-sentinel" + "x".repeat(5000)
      )
      write(
        directory,
        "packages/domain/src/server.ts",
        'export const secret = "private-api-sentinel"'
      )
      if (fixture.packageRoot) {
        const packageRoot = path.join(directory, fixture.packageRoot)
        const installed = path.dirname(
          createRequire(
            path.join(root, "packages/domain/src/index.ts")
          ).resolve("zod/package.json")
        )
        cpSync(installed, packageRoot, { recursive: true })
        cpSync(
          path.join(packageRoot, "index.js"),
          path.join(packageRoot, "original.js")
        )
        rmSync(path.join(directory, "packages/domain/node_modules"))
        mkdirSync(path.join(directory, "packages/domain/node_modules"))
        symlinkSync(
          packageRoot,
          path.join(directory, "packages/domain/node_modules/zod"),
          "dir"
        )
      }
      for (const [file, text] of Object.entries(fixture.files))
        write(directory, file, text)
      for (const [file, destination] of Object.entries(fixture.links ?? {}))
        symlinkSync(
          path.join(directory, destination),
          path.join(directory, file)
        )
      const callback = fixture.source.replace("export const dependsOn = ", "")
      write(
        directory,
        declaration,
        (fixture.declarationImports ?? "") +
          descriptor().replace("dependsOn: () => []", `dependsOn: ${callback}`)
      )
      await assert.rejects(
        buildBrowserCatalog(directory),
        { kind: "browser-import" },
        fixture.name
      )
    })
  }
})

test("Vite backstop rejects inlined data URLs and unapproved package modules", async (t) => {
  const directory = browserWorkspace(t)
  write(directory, implementation, server)
  write(directory, declaration, descriptor())
  await catalog("generate", directory)
  write(
    directory,
    declaration,
    descriptor().replace(
      "dependsOn: () => []",
      'dependsOn: () => [{ name: "data:text/plain,private", coachFloor: "auto" }]'
    )
  )
  await assert.rejects(buildBrowserCatalog(directory), /without data: URLs/)
  write(
    directory,
    "dependency/node_modules/unapproved/value.js",
    'export const value = "private"'
  )
  write(
    directory,
    declaration,
    `${descriptor()}\nexport { value } from "../../../../../../dependency/node_modules/unapproved/value.js"`
  )
  await assert.rejects(buildBrowserCatalog(directory), {
    kind: "browser-import",
  })
  write(directory, declaration, descriptor())
  const result = await buildBrowserCatalog(directory)
  assert.ok(result.output.length > 0)
  assert.ok(
    result.output.every(
      (output) =>
        output.type === "chunk" &&
        output.fileName.endsWith(".js") &&
        !/\bdata:[^\s"\x27`]*,/i.test(output.code)
    )
  )
})
