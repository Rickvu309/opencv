import { execFileSync } from "node:child_process"
import {
  consumers,
  detectStyleCascade,
  detectLinkCompatibility,
  detectLinkDecorations as detectDecorations,
} from "./lib/paper-rich-structure.mjs"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectDirectMarks as detect } from "./lib/paper-rich-structure.mjs"

test("Word link styling preserves direct marks instead of stripping their XML", () => {
  for (const mark of ["b", "i", "u", "strike", "color", "rStyle"])
    assert.ok(
      detect(`properties.replace(/<w:${mark}\\b[^>]*\\/>/g, "")`).length > 0
    )
  assert.deepEqual(detect("wordRun(text, properties, href, links)"), [])
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../apps/api/src/paper/native-output/rich-text.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})

const imported =
  'import { effectiveRunDecorations } from "@workspace/domain/internal/paper-presentation";'
const delegated = `${imported} const decorations = effectiveRunDecorations(marks, isLink, inherited)`

test("page, toolbar and Word delegate link decorations to the domain", () => {
  for (const path of consumers) {
    for (const mistake of [
      "const decorations = isLink ? { underline: true } : marks",
      `${delegated}; const value = { ...decorations, ...(isLink ? { underline: true } : {}) }`,
      `${delegated}; if (href) { value.underline = true }`,
      `${delegated}; const underline = isLink || marks.underline`,
      `${delegated}; if (href) { value.color = paperLinkColor }`,
      `${delegated}; const xml = href ? '<w:u w:val="single"/>' : ''`,
      `${delegated}; const style = isLink && 'color:#1D4ED8'`,
    ])
      assert.ok(detectDecorations(mistake, path).length, `${path}: ${mistake}`)
    assert.deepEqual(detectDecorations(delegated, path), [], path)
    assert.deepEqual(readCurrent(path), [], path)
  }
})

function readCurrent(path) {
  return detectDecorations(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    path
  )
}

test("rejects independent implementations at their introducing commits", () => {
  for (const path of consumers) {
    const before = execFileSync(
      "git",
      [
        "show",
        `${path.endsWith("native-layout-formatting.ts") ? "2d8c005a50b97a773349d415aa6b1b410a6ca71f" : "7195fc723aa9061d12debf62aa1261924a791f54"}:${path}`,
      ],
      { encoding: "utf8" }
    )
    assert.ok(detectDecorations(before, path).length, path)
  }
})

test("explicit link color, named styles and legacy packages survive rich link defaults", () => {
  for (const [sha, path] of [
    ["19b30732", "packages/domain/src/paper-doc/paragraph-styles.ts"],
    ["2f37a898", "apps/api/src/paper/native-output/package.ts"],
  ]) {
    const before = execFileSync("git", ["show", `${sha}:${path}`], {
      encoding: "utf8",
    })
    assert.ok(detectLinkCompatibility(before, path).length, path)
    assert.deepEqual(
      detectLinkCompatibility(
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
        path
      ),
      []
    )
  }
  const before = execFileSync(
    "git",
    [
      "show",
      "0f2fa9c59e7e444f4dd7129ca1457c7b6c88fd42:apps/api/src/paper/native-output/rich-text.ts",
    ],
    { encoding: "utf8" }
  )
  assert.ok(detect(before).length)
  assert.ok(
    detectLinkCompatibility(
      "color: isLink ? paperLinkColor : marks.color",
      "packages/domain/src/paper-doc/paragraph-styles.ts"
    ).length
  )
  assert.deepEqual(
    detectLinkCompatibility(
      "color: marks.color ?? (isLink ? paperLinkColor : inherited.color)",
      "packages/domain/src/paper-doc/paragraph-styles.ts"
    ),
    []
  )
  assert.ok(
    detectLinkCompatibility(
      '<w:style w:styleId="Hyperlink"/>',
      "apps/api/src/paper/native-output/package.ts"
    ).length
  )
  assert.deepEqual(
    detectLinkCompatibility(
      'input.richLinks && input.links.length; <w:style w:styleId="Hyperlink"/>',
      "apps/api/src/paper/native-output/package.ts"
    ),
    []
  )
})

test("the full style cascade and shared Docs groups reject their introducing mistakes", () => {
  for (const path of [
    "packages/paper-crdt/src/native-formatting-decorations.ts",
    "packages/paper-crdt/src/editor.ts",
    "packages/paper-crdt/src/native-layout-flow-mount.ts",
    "packages/paper-crdt/src/native-layout-formatting.ts",
    "apps/api/src/paper/native-output/formatted.ts",
    "packages/domain/src/paper-doc/paragraph-styles.ts",
    "packages/domain/src/paper-doc/presentation-styles.ts",
    "apps/web/src/features/paper/rich-structure-controls.tsx",
    "apps/web/src/features/paper/rich-text-formatting.tsx",
  ]) {
    const before = execFileSync(
      "git",
      [
        "show",
        `${path.endsWith("native-layout-formatting.ts") ? "2d8c005a" : "6017f74c"}:${path}`,
      ],
      { encoding: "utf8" }
    )
    assert.ok(detectStyleCascade(before, path).length, path)
    assert.deepEqual(
      detectStyleCascade(
        readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
        path
      ),
      [],
      path
    )
  }
  const path = "packages/paper-crdt/src/native-formatting-decorations.ts"
  assert.ok(
    detectStyleCascade(
      "effectiveInline(presentation, { ...paragraphInlineValues(style), ...direct })",
      path
    ).length
  )
  assert.deepEqual(
    detectStyleCascade("effectiveInline(presentation, direct, style)", path),
    []
  )
})

test("character inheritance and list indent dispatch have clean and mistake fixtures", () => {
  for (const [path, mistake, clean] of [
    [
      "packages/domain/src/paper-doc/presentation-styles.ts",
      "{ ...paragraph, ...character.value, ...direct }",
      "overlay(overlay(paragraph, character.value), direct)",
    ],
    [
      "apps/web/src/features/paper/rich-text-formatting.tsx",
      "<RichTextParagraphGroup />",
      "<RichTextParagraphGroup />; controls: structure",
    ],
    [
      "packages/paper-crdt/src/native-layout-formatting.ts",
      "effectiveInline(presentation, direct)",
      "effectiveInline(presentation, direct, effectiveParagraphStyle())",
    ],
    [
      "apps/api/src/paper/native-output/formatted.ts",
      "const inherited = paragraphInlineValues(paragraphStyle)",
      "const inherited = direct.characterStyle ? styles.effectiveInline(direct) : paragraphInlineValues(paragraphStyle)",
    ],
    [
      "packages/paper-crdt/src/editor.ts",
      "mounted.adjustIndent(delta)",
      "else mounted.adjustIndent(delta)",
    ],
  ]) {
    assert.ok(detectStyleCascade(mistake, path).length)
    assert.deepEqual(detectStyleCascade(clean, path), [])
  }
})

test("the merged history toolbar keeps paragraph controls on one desktop row", () => {
  const path = "apps/web/src/features/paper/rich-text-formatting.tsx"
  const before = execFileSync("git", ["show", `31528653:${path}`], {
    encoding: "utf8",
  })
  const clean = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  assert.ok(
    detectStyleCascade(before, path).some((hit) =>
      hit.includes("single Docs row")
    )
  )
  assert.deepEqual(detectStyleCascade(clean, path), [])
  assert.ok(
    detectStyleCascade(
      clean.replace("shrink-0 [&>div]:flex-nowrap", "contents"),
      path
    ).length
  )
})
