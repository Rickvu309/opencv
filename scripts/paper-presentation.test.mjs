import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { detect } from "./lib/paper-presentation.mjs"
import { clean, mistakes } from "./fixtures/paper-presentation.mjs"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
test("private formatting preserves package boundaries, real owners, XML anchors and one text store", () => {
  for (const fixture of mistakes)
    assert.ok(detect(fixture.text, fixture.path).length, fixture.path)
  for (const fixture of clean)
    assert.deepEqual(detect(fixture.text, fixture.path), [], fixture.path)
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "packages",
      "apps",
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    }
  )
    .split("\n")
    .filter(
      (file) =>
        /\.[cm]?[jt]sx?$/.test(file) && existsSync(path.join(root, file))
    )
  for (const file of files)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
})

test("round-one guards refuse the introducing formatting commit", () => {
  const introduced = "2d8c005a50b97a773349d415aa6b1b410a6ca71f"
  for (const file of [
    "packages/paper-crdt/src/editor.ts",
    "packages/paper-crdt/src/native-layout-formatting.ts",
    "packages/paper-crdt/src/native-formatting-render-values.ts",
    "apps/api/src/paper/native-output/formatted-properties.ts",
  ]) {
    const text = execFileSync("git", ["show", `${introduced}:${file}`], {
      cwd: root,
      encoding: "utf8",
    })
    assert.ok(detect(text, file).length > 0, file)
  }
})
