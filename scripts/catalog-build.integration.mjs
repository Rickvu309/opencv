import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"

import { root } from "./catalog.mjs"
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
