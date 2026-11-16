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

test("round-one guards reject the reviewed head and accept the repaired sources", () => {
  for (const file of [
    "apps/web/src/features/paper/rich-structure-controls.tsx",
    "packages/paper-crdt/src/native-formatting-commands.ts",
    "packages/paper-crdt/src/native-formatting-decorations.ts",
    "apps/api/src/paper/native-output/formatted.ts",
  ]) {
    const original = execFileSync(
      "git",
      ["show", "76bc742eaf0cbfd579d930a91bea052dc7193570:" + file],
      { cwd: root, encoding: "utf8" }
    )
    assert.ok(detect(original, file).length, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("unstyled paragraph defaults survive semantic heading resolution", () => {
  const file = "packages/domain/src/paper-doc/paragraph-styles.ts"
  const original = execFileSync(
    "git",
    ["show", "27680a33bfa52c3b2529e851047f6d9a354efca1:" + file],
    { cwd: root, encoding: "utf8" }
  )
  assert.ok(
    detect(original, file).some((hit) =>
      hit.includes("document formatting defaults")
    )
  )
  assert.deepEqual(
    detect(readFileSync(path.join(root, file), "utf8"), file),
    []
  )
})

test("round-two guards reject reviewed sources and accept shared link presentation and bounded list controls", () => {
  for (const file of [
    "apps/web/src/features/paper/rich-structure-controls.tsx",
    "packages/paper-crdt/src/native-formatting-commands.ts",
    "packages/paper-crdt/src/native-formatting-decorations.ts",
    "apps/api/src/paper/native-output/package.ts",
  ]) {
    const original = execFileSync(
      "git",
      ["show", "76bc742eaf0cbfd579d930a91bea052dc7193570:" + file],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
    assert.ok(detect(original, file).length, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("round-three guards reject decoration overrides and shared field errors with historical proof", () => {
  const cases = [
    [
      "packages/paper-crdt/src/native-formatting-decorations.ts",
      "compose marks",
      "2f37a898",
    ],
    [
      "apps/web/src/features/paper/rich-structure-controls.tsx",
      "failed field",
      "27680a33",
    ],
  ]
  for (const [file, message, sha] of cases) {
    const original = execFileSync("git", ["show", `${sha}:${file}`], {
      cwd: root,
      encoding: "utf8",
    })
    assert.ok(
      detect(original, file).some((hit) => hit.includes(message)),
      file
    )
    const current = readFileSync(path.join(root, file), "utf8")
    assert.deepEqual(detect(current, file), [])
    const mistake = file.endsWith("decorations.ts")
      ? current.replace(
          "style: inlineCss({",
          'style: "text-decoration:underline;" + inlineCss({'
        )
      : current.replace(
          /error === "Enter a website or email address\."\s*\? "paper-link-error"/,
          'error ? "paper-link-error"'
        )
    assert.ok(
      detect(mistake, file).some((hit) => hit.includes(message)),
      file
    )
  }
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
