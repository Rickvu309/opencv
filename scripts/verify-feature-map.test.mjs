import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const features = path.join(root, ".claude/skills/verify-opencv/features")
const readme = readFileSync(path.join(features, "README.md"), "utf8")

const listed = [...readme.matchAll(/^\| `([\w-]+\.md)`\s*\|/gm)].map(
  (hit) => hit[1]
)

test("every feature file is in the verify-opencv index", () => {
  const onDisk = readdirSync(features).filter(
    (name) => name.endsWith(".md") && name !== "README.md"
  )
  assert.deepEqual(
    onDisk.filter((name) => !listed.includes(name)),
    [],
    "Add the file to the Features table in features/README.md, or delete it."
  )
})

test("every file the verify-opencv index lists exists", () => {
  assert.deepEqual(
    listed.filter((name) => !existsSync(path.join(features, name))),
    [],
    "Remove the row from the Features table in features/README.md, or restore the file."
  )
})

test("the verify-opencv sync commit is in this history", () => {
  const sha = /^Sync commit: `([0-9a-f]{40})`/m.exec(readme)?.[1]
  assert.ok(sha, "features/README.md needs a 'Sync commit: `<40 hex>`' line.")
  assert.doesNotThrow(
    () =>
      execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], {
        cwd: root,
        stdio: "ignore",
      }),
    `Sync commit ${sha} is not an ancestor of HEAD. Set it to a commit on main.`
  )
})
