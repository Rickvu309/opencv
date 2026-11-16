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

test("photo guards catch the reviewed insertion, dimension, selection and preview mistakes", () => {
  for (const file of [
    "packages/paper-crdt/src/native-layout-photo-controls.ts",
    "apps/web/src/features/paper/rich-photo-controls.tsx",
  ]) {
    const before = execFileSync("git", ["show", `810e5694:${file}`], {
      cwd: root,
      encoding: "utf8",
    })
    assert.ok(detect(before, file).length > 0, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("round-two photo guards reject the crop ratchet and hidden actions at their introducing heads", () => {
  for (const file of [
    "apps/web/src/features/paper/rich-photo-controls.tsx",
    "apps/web/src/features/paper/rich-photo-preview.tsx",
    "packages/paper-crdt/src/native-layout-photo-controls.ts",
  ]) {
    const before = execFileSync("git", ["show", `75fd7496:${file}`], {
      cwd: root,
      encoding: "utf8",
    })
    assert.ok(detect(before, file).length > 0, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("round-three photo guards reject refused drafts, late upload checks and invisible circle projections", () => {
  for (const file of [
    "apps/web/src/features/paper/rich-photo-number.tsx",
    "apps/web/src/features/paper/rich-photo-controls.tsx",
    "packages/domain/src/paper-doc/native-photo-geometry.ts",
  ]) {
    const before = execFileSync("git", ["show", `c9f04c8f:${file}`], {
      cwd: root,
      encoding: "utf8",
    })
    assert.ok(detect(before, file).length > 0, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("round-four photo guards reject split text state and Apply without whole-form validation at the reviewed head", () => {
  for (const file of [
    "apps/web/src/features/paper/rich-photo-number.tsx",
    "apps/web/src/features/paper/rich-photo-controls.tsx",
  ]) {
    const before = execFileSync("git", ["show", `14318911:${file}`], {
      cwd: root,
      encoding: "utf8",
    })
    assert.ok(detect(before, file).length > 0, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("round-five photo Apply rejects conditional geometry, lost placement and raw display precision at the introducing head", () => {
  const file = "apps/web/src/features/paper/rich-photo-form.ts"
  const before = execFileSync("git", ["show", `fe40fd4f:${file}`], {
    cwd: root,
    encoding: "utf8",
  })
  assert.ok(detect(before, file).length > 0)
  assert.deepEqual(
    detect(readFileSync(path.join(root, file), "utf8"), file),
    []
  )
})
