import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { detect } from "./lib/paper-presentation.mjs"
import { clean, mistakes } from "./fixtures/paper-presentation.mjs"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
test("rich document headers allow enlarged titles and actions to wrap", () => {
  const path = "apps/web/src/features/paper/design/rich-page-header.pen.css"
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  const mistake = clean.replace("flex-wrap: wrap;", "flex-wrap: nowrap;")
  assert.notEqual(mistake, clean)
  assert.deepEqual(detect(clean, path), [])
  assert.ok(detect(mistake, path).some((hit) => hit.includes("enlarged text")))
})

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
