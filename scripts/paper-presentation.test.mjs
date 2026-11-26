import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { detect, detectDocumentHistory } from "./lib/paper-presentation.mjs"
import { detectPhotoApplyRounding } from "./lib/paper-photo-guard.mjs"
import { clean, mistakes, roundTwo } from "./fixtures/paper-presentation.mjs"
import { pathAtRevision } from "./lib/path-at-revision.mjs"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
test("rich document headers allow enlarged titles and actions to wrap", () => {
  const path = "apps/web/src/features/paper/design/rich-page-header.css"
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
    const text = execFileSync(
      "git",
      ["show", `${introduced}:${pathAtRevision(introduced, file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
    assert.ok(detect(text, file).length > 0, file)
  }
})

test("round-two regressions fire on fixtures and the introducing head, while the fixes stay quiet", () => {
  for (const fixture of roundTwo) {
    assert.ok(detect(fixture.mistake, fixture.path).length, fixture.path)
    assert.deepEqual(detect(fixture.clean, fixture.path), [], fixture.path)
    const old = execFileSync(
      "git",
      [
        "show",
        `09c29ba06a01cf6b7961c03a46f5b068b6258cf9:${pathAtRevision("09c29ba06a01cf6b7961c03a46f5b068b6258cf9", fixture.path)}`,
      ],
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
    "apps/web/src/features/paper/rich-editor/rich-structure-controls.tsx",
    "packages/paper-crdt/src/native-formatting-commands.ts",
    "packages/paper-crdt/src/native-formatting-decorations.ts",
    "apps/api/src/paper/native-output/formatted.ts",
  ]) {
    const original = execFileSync(
      "git",
      [
        "show",
        "76bc742eaf0cbfd579d930a91bea052dc7193570:" +
          pathAtRevision("76bc742eaf0cbfd579d930a91bea052dc7193570", file),
      ],
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
    "apps/web/src/features/paper/rich-editor/rich-structure-controls.tsx",
    "packages/paper-crdt/src/native-formatting-commands.ts",
    "packages/paper-crdt/src/native-formatting-decorations.ts",
    "apps/api/src/paper/native-output/package.ts",
  ]) {
    const original = execFileSync(
      "git",
      [
        "show",
        "76bc742eaf0cbfd579d930a91bea052dc7193570:" +
          pathAtRevision("76bc742eaf0cbfd579d930a91bea052dc7193570", file),
      ],
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
      "apps/web/src/features/paper/rich-editor/rich-structure-controls.tsx",
      "failed field",
      "27680a33",
    ],
  ]
  for (const [file, message, sha] of cases) {
    const original = execFileSync(
      "git",
      ["show", `${sha}:${pathAtRevision(sha, file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
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

test("photo guards catch the reviewed insertion, dimension, selection and preview mistakes", () => {
  for (const file of [
    "packages/paper-crdt/src/native-layout-photo-controls.ts",
    "apps/web/src/features/paper/rich-editor/rich-photo-controls.tsx",
  ]) {
    const before = execFileSync(
      "git",
      ["show", `810e5694:${pathAtRevision("810e5694", file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
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
    "apps/web/src/features/paper/rich-editor/rich-photo-controls.tsx",
    "apps/web/src/features/paper/rich-editor/rich-photo-preview.tsx",
    "packages/paper-crdt/src/native-layout-photo-controls.ts",
  ]) {
    const before = execFileSync(
      "git",
      ["show", `75fd7496:${pathAtRevision("75fd7496", file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
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
    "apps/web/src/features/paper/rich-editor/rich-photo-number.tsx",
    "apps/web/src/features/paper/rich-editor/rich-photo-controls.tsx",
    "packages/domain/src/paper-doc/native-photo-geometry.ts",
  ]) {
    const before = execFileSync(
      "git",
      ["show", `c9f04c8f:${pathAtRevision("c9f04c8f", file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
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
    "apps/web/src/features/paper/rich-editor/rich-photo-number.tsx",
    "apps/web/src/features/paper/rich-editor/rich-photo-controls.tsx",
  ]) {
    const before = execFileSync(
      "git",
      ["show", `14318911:${pathAtRevision("14318911", file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
    assert.ok(detect(before, file).length > 0, file)
    assert.deepEqual(
      detect(readFileSync(path.join(root, file), "utf8"), file),
      [],
      file
    )
  }
})

test("round-five photo Apply rejects conditional geometry, lost placement and raw display precision at the introducing head", () => {
  const file = "apps/web/src/features/paper/rich-editor/rich-photo-form.ts"
  const before = execFileSync(
    "git",
    ["show", `fe40fd4f:${pathAtRevision("fe40fd4f", file)}`],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
  assert.ok(detect(before, file).length > 0)
  assert.deepEqual(
    detect(readFileSync(path.join(root, file), "utf8"), file),
    []
  )
})

test("phone overflow guard refuses empty menus and dangling photo separators", () => {
  const formatting = "apps/web/src/features/paper/rich-text-formatting.tsx"
  const photos = "apps/web/src/features/paper/rich-photo-toolbar.tsx"
  for (const [path, commit, message] of [
    [formatting, "54fbdb62", "Empty formatting overflow"],
    [photos, "e1507671", "append a separator"],
  ]) {
    const before = execFileSync(
      "git",
      ["show", `${commit}:${pathAtRevision(commit, path)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
    assert.ok(
      detectDocumentHistory(before, path).some((hit) => hit.includes(message))
    )
  }
  const toolbar =
    'role="toolbar" <RichDocumentHistory /> {!compact <Font />} aria-label="More formatting"'
  assert.ok(
    detectDocumentHistory(toolbar, formatting).some((hit) =>
      hit.includes("Empty formatting overflow")
    )
  )
  assert.deepEqual(
    detectDocumentHistory(
      toolbar + " !formatting?.hasText && !hasPhotoControls",
      formatting
    ),
    []
  )
  assert.ok(
    detectDocumentHistory(
      'export function RichPhotoToolbar() { role="separator" }',
      photos
    ).length
  )
  assert.deepEqual(
    detectDocumentHistory(
      "export function RichPhotoToolbar() { <Photos /> }",
      photos
    ),
    []
  )
})

test("round-six photo Apply guard refuses refitting consistent fields at the introducing head", () => {
  const file = "apps/web/src/features/paper/rich-editor/rich-photo-form.ts"
  const mistake = execFileSync(
    "git",
    ["show", `dfdf0043:${pathAtRevision("dfdf0043", file)}`],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
  const clean = readFileSync(path.join(root, file), "utf8")
  assert.equal(detectPhotoApplyRounding(mistake, file).length, 2)
  assert.deepEqual(detectPhotoApplyRounding(clean, file), [])
  for (const gate of ["cropNeedsFit", "sizeNeedsFit"]) {
    assert.ok(
      detectPhotoApplyRounding(
        clean.replace(`editedField || ${gate}`, "true"),
        file
      ).length > 0
    )
  }
})

test("round-six photo blur guard catches the original unconditional commit", () => {
  const file = "apps/web/src/features/paper/rich-editor/rich-photo-number.tsx"
  const mistake = execFileSync(
    "git",
    ["show", `dfdf0043:${pathAtRevision("dfdf0043", file)}`],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
  assert.equal(detectPhotoApplyRounding(mistake, file).length, 1)
  assert.deepEqual(
    detectPhotoApplyRounding(readFileSync(path.join(root, file), "utf8"), file),
    []
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
    const text = execFileSync(
      "git",
      ["show", `${introduced}:${pathAtRevision(introduced, file)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
    assert.ok(detect(text, file).length > 0, file)
  }
})

test("round-two regressions fire on fixtures and the introducing head, while the fixes stay quiet", () => {
  for (const fixture of roundTwo) {
    assert.ok(detect(fixture.mistake, fixture.path).length, fixture.path)
    assert.deepEqual(detect(fixture.clean, fixture.path), [], fixture.path)
    const old = execFileSync(
      "git",
      [
        "show",
        `09c29ba06a01cf6b7961c03a46f5b068b6258cf9:${pathAtRevision("09c29ba06a01cf6b7961c03a46f5b068b6258cf9", fixture.path)}`,
      ],
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

test("document history guard rejects misplaced and photo-owned history at its introducing head", () => {
  const paths = [
    "apps/web/src/features/paper/rich-text-formatting.tsx",
    "apps/web/src/features/paper/rich-editor/rich-document-toolbar.tsx",
    "packages/paper-crdt/src/native-layout-photo-controls.ts",
  ]
  for (const path of paths) {
    const oldPath = path.replace(
      "rich-editor/rich-document-toolbar",
      "rich-photo-toolbar"
    )
    const introduced = path.endsWith("rich-text-formatting.tsx")
      ? "54fbdb62"
      : path.endsWith("native-layout-photo-controls.ts")
        ? "b45e5d82"
        : "dd38b260"
    const before = execFileSync(
      "git",
      ["show", `${introduced}:${pathAtRevision(introduced, oldPath)}`],
      {
        cwd: root,
        encoding: "utf8",
      }
    )
    assert.ok(detectDocumentHistory(before, oldPath).length > 0, oldPath)
    assert.deepEqual(
      detectDocumentHistory(
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
        path
      ),
      [],
      path
    )
  }
  assert.ok(
    detectDocumentHistory(
      'role="toolbar" {!compact ? <RichDocumentHistory /> : null}',
      paths[0]
    ).length > 0
  )
  assert.deepEqual(
    detectDocumentHistory(
      'role="toolbar" <RichDocumentHistory /> {!compact ? <Font /> : null}',
      paths[0]
    ),
    []
  )
})

test("page layout guards reject the reviewed lifetime, phone and pagination regressions", () => {
  const files = [
    "packages/paper-crdt/src/presentation-meta.ts",
    "packages/paper-crdt/src/native-layout-flow.ts",
    "apps/web/src/features/paper/rich-editor/rich-page-geometry.css",
    "packages/paper-crdt/src/native-layout-flow-mount.ts",
    "packages/paper-crdt/src/rich-page-layout.ts",
    "packages/paper-crdt/src/editor.ts",
    "packages/paper-crdt/src/native-layout-page-commands.ts",
    "apps/web/src/features/paper/rich-editor/rich-page-setup.tsx",
    "apps/web/src/features/paper/rich-editor/rich-page-break.tsx",
  ]
  for (const file of files) {
    const reviewed =
      file === "packages/paper-crdt/src/rich-page-layout.ts"
        ? "f66e65e0"
        : "6a8d3959"
    const original = execFileSync(
      "git",
      ["show", `${reviewed}:${pathAtRevision(reviewed, file)}`],
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

test("all responsive queries preserve physical Paper geometry", () => {
  const file = "apps/web/src/features/paper/rich-editor/rich-page-geometry.css"
  for (const query of [
    "@media (max-height: 600px)",
    "@media (aspect-ratio < 1)",
    "@media (pointer: coarse)",
    "@container paper (block-size < 600px)",
  ]) {
    assert.match(
      detect(
        `${query} { .paper-rich-sheet p { font-size: 20px; } }`,
        file
      ).join(),
      /scale the page in rich-page-layout.ts instead/
    )
    assert.deepEqual(
      detect(`${query} { .paper-toolbar { padding: 12px; } }`, file),
      []
    )
  }
})
