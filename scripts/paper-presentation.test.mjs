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

test("the rich link guard catches the original mount without the domain policy", () => {
  const file = "packages/paper-crdt/src/native-layout-flow-mount.ts"
  const original = execFileSync(
    "git",
    ["show", "468dda36d4d4f6b81eadefbd1af81ad0792c562c:" + file],
    { cwd: root, encoding: "utf8" }
  )
  assert.ok(detect(original, file).some((hit) => hit.includes("mailto policy")))
  assert.ok(
    detect(original, file).some((hit) =>
      hit.includes("paragraph style defaults")
    )
  )
})

test("the list marker guard catches the original custom rich renderer", () => {
  const file = "packages/paper-crdt/src/native-formatting-decorations.ts"
  const original = execFileSync(
    "git",
    ["show", "2a8c8e8b8db8c63e760551ed7dbb2ab62acc009c:" + file],
    { cwd: root, encoding: "utf8" }
  )
  assert.ok(
    detect(original, file).some((hit) => hit.includes("render markers"))
  )
})

test("the Docs shortcut guard catches the original strikethrough mapping", () => {
  const file = "packages/paper-crdt/src/native-formatting-commands.ts"
  const original = execFileSync(
    "git",
    ["show", "caa5284fc9245f96e59d52b949e8f220c3955ce1:" + file],
    { cwd: root, encoding: "utf8" }
  )
  assert.ok(
    detect(original, file).some((hit) => hit.includes("Docs shortcuts"))
  )
})
