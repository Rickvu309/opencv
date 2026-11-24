import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { madeUpPeople } from "./lib/made-up-person.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const productFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "apps/api/src"],
    { cwd: root, encoding: "utf8", timeout: 60_000 }
  )
    .split("\n")
    .filter((file) => /\.ts$/.test(file))
    .filter((file) => !/\.test\.ts$|\.test-support\.ts$|\/test\//.test(file))
    .filter((file) => existsSync(path.join(root, file)))

test("MISTAKE: a read that runs as a person with a written-in name fires", () => {
  const problems = madeUpPeople(
    'const data = await registry.read("paper.shared", input, personActor("public"))',
    "apps/api/src/paper/http.ts"
  )
  assert.equal(problems.length, 1)
  assert.match(problems[0], /apps\/api\/src\/paper\/http\.ts:1/)
  assert.match(problems[0], /readAsVisitor/)
})

test("a person taken from the session stays quiet", () => {
  assert.deepEqual(
    madeUpPeople("registry.read(name, input, personActor(c.var.userId))"),
    []
  )
})

test("no product code runs a read or a command as a made-up person", () => {
  assert.deepEqual(
    productFiles().flatMap((file) =>
      madeUpPeople(readFileSync(path.join(root, file), "utf8"), file)
    ),
    []
  )
})
