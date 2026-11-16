import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { detect } from "./lib/paper-presentation.mjs"
import { clean, mistakes, roundTwo } from "./fixtures/paper-presentation.mjs"

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
      "scripts",
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

test("round-two regressions fire on fixtures and the introducing head, while the fixes stay quiet", () => {
  for (const fixture of roundTwo) {
    assert.ok(detect(fixture.mistake, fixture.path).length, fixture.path)
    assert.deepEqual(detect(fixture.clean, fixture.path), [], fixture.path)
    const old = execFileSync(
      "git",
      ["show", `09c29ba06a01cf6b7961c03a46f5b068b6258cf9:${fixture.path}`],
      { cwd: root, encoding: "utf8" }
    )
    assert.ok(detect(old, fixture.path).length, fixture.path)
    if (existsSync(path.join(root, fixture.path)))
      assert.deepEqual(
        detect(
          readFileSync(path.join(root, fixture.path), "utf8"),
          fixture.path
        ),
        [],
        fixture.path
      )
  }
})
