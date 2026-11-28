import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { filesAndFolders, missingRepoPaths } from "./lib/doc-paths.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const repoFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
    .filter((file) => existsSync(path.join(root, file)))

test("every repo path a tracked Markdown file names in backticks exists", () => {
  const known = filesAndFolders([
    "apps/web/src/main.tsx",
    "scripts/ui.mjs",
    "docs/packs.md",
  ])
  assert.deepEqual(
    missingRepoPaths(
      "The old core (`packages/paper-crdt`, `apps/api/src/paper/content`) stays.",
      known
    ),
    ["packages/paper-crdt", "apps/api/src/paper/content"]
  )
  assert.deepEqual(
    missingRepoPaths(
      "Run `node scripts/ui.mjs shot` from `apps/web/src/`, see `docs/packs.md#layers`, `scripts/ui.mjs:12` and `packages/<name>/src` or `apps/**`.",
      known
    ),
    []
  )
  const files = repoFiles()
  const knownHere = filesAndFolders(files)
  const missing = files
    .filter((file) => file.endsWith(".md"))
    .flatMap((file) =>
      missingRepoPaths(
        readFileSync(path.join(root, file), "utf8"),
        knownHere
      ).map((named) => `${file} names ${named}, which does not exist`)
    )
  assert.deepEqual(missing, [])
})
