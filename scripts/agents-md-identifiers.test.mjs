import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { undeclaredNames } from "./lib/doc-identifiers.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const declaringSources = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps",
      "packages",
      "scripts",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.(ts|tsx|mjs)$/.test(file))
    .filter((file) => !/(\.test\.|fixtures|\/retired\/|\/test\/)/.test(file))
    .filter((file) => existsSync(path.join(root, file)))
    .map((file) => readFileSync(path.join(root, file), "utf8"))

test("every function AGENTS.md names in backticks is declared in the code", () => {
  assert.deepEqual(
    undeclaredNames("Use `runGone` and `keptHere.run`.", [
      "export const keptHere = make()",
    ]),
    ["runGone"]
  )
  assert.deepEqual(
    undeclaredNames("Use `keptHere.run` and `ci.yml`.", [
      "export const keptHere = make()",
    ]),
    []
  )
  assert.deepEqual(
    undeclaredNames(
      readFileSync(path.join(root, "AGENTS.md"), "utf8"),
      declaringSources()
    ),
    []
  )
})
