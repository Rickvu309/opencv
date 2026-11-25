import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-page-scale.mjs"

const css = "apps/web/src/features/paper/rich-page-geometry.css"
const layout = "packages/paper-crdt/src/rich-page-layout.ts"

test("responsive Paper geometry mistakes fail with the scaling remedy", () => {
  for (const query of [
    "@media (max-width: 767px)",
    "@container paper (inline-size < 800px)",
  ]) {
    for (const selector of [
      ".paper-rich-sheet",
      '.paper-rich-sheet [data-paper-layout="paperCell"]',
    ]) {
      for (const declaration of [
        "padding: 20px",
        "font-size: 16px",
        "inline-size: 100%",
        "column-count: 1",
        "height: auto",
      ]) {
        assert.match(
          detect(`${query} { ${selector} { ${declaration}; } }`, css).join(),
          /scale the page in rich-page-layout.ts instead/
        )
      }
    }
  }
  for (const source of [
    "const reflow = available < width",
    "if (host.clientWidth < pageWidth) host.style.padding = '20px'",
    "host.dataset.paperCompact = String(available < pageWidth)",
    "host.setAttribute('data-paper-mobile', String(innerWidth < 800))",
    "const narrow = window.innerWidth < 800; if (narrow) host.classList.add('compact')",
    "element.dataset.paperReflow = 'false'",
  ])
    assert.ok(detect(source, layout).length, source)
})

test("uniform scaling and responsive chrome stay quiet", () => {
  for (const source of [
    ".paper-rich-sheet { padding: var(--cv-rich-page-start); zoom: var(--cv-rich-page-scale); }",
    "@media (max-width: 767px) { .paper-toolbar { padding: 12px; } }",
    "@media (prefers-reduced-motion: reduce) { .paper-rich-sheet { transition: none; } }",
    "@media (hover: hover) and (pointer: fine) { .paper-rich-sheet button { background: var(--muted); } }",
  ])
    assert.deepEqual(detect(source, css), [], source)
  assert.deepEqual(
    detect(
      "const scale = Math.min(1, available / width); host.style.setProperty('--cv-rich-page-scale', String(scale))",
      layout
    ),
    []
  )
})

test("the original reflow commit fails and current Paper sources pass", () => {
  for (const file of [css, layout]) {
    const historic = execFileSync("git", ["show", `f66e65e0:${file}`], {
      encoding: "utf8",
    })
    assert.ok(detect(historic, file).length, file)
  }
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "apps/web/src/features/paper",
      "apps/web/src/features/paper-page",
      "apps/web/src/styles",
      "packages/paper-crdt/src",
      "packages/domain/src/paper-doc/paper-page-scale.ts",
    ],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
  for (const file of files)
    assert.deepEqual(detect(readFileSync(file, "utf8"), file), [], file)
})

const picture = "apps/web/src/features/paper/"
const pictureCss = picture + "design/paper-picture.css"
const galleryCss = picture + "design/paper-template-gallery.css"
const card = picture + "paper-library-card.tsx"

test("Paper pictures and carousel sizing use the shared A4 ratio", () => {
  for (const [file, source] of [
    [card, '<span className="aspect-[17/22]" />'],
    [card, '<span className="sm:aspect-video" />'],
    [card, '<span className="[aspect-ratio:3/4]" />'],
    [card, "<span style={{ aspectRatio: 0.707 }} />"],
    [galleryCss, ".paper-picker-page { aspect-ratio: 210 / 297; }"],
    [galleryCss, ".paper-picker-page { width: calc(100cqh * 17 / 22); }"],
    [galleryCss, ".paper-picker-page { width: calc(100cqh * 0.707); }"],
    [galleryCss, ".paper-picker-page { --cv-paper-picture-ratio: 3 / 4; }"],
  ])
    assert.match(detect(source, file).join(), /shared A4 ratio/, source)

  for (const [file, source] of [
    [
      pictureCss,
      ".paper-picture { aspect-ratio: var(--cv-paper-picture-ratio); }",
    ],
    [
      galleryCss,
      ".paper-picker-page { width: calc(100cqh * var(--cv-paper-picture-ratio)); }",
    ],
    [card, '<span className="paper-picture" />'],
  ])
    assert.deepEqual(detect(source, file), [], source)

  const shared = readFileSync(pictureCss, "utf8")
  assert.deepEqual(detect(shared, pictureCss), [])
  assert.deepEqual(
    [...shared.matchAll(/--cv-paper-picture-ratio:\s*([^;]+);/g)].map(
      (match) => match[1]
    ),
    ["calc(210 / 297)"]
  )
})

test("the earlier US Letter thumbnails fail the A4 picture guard", () => {
  for (const file of [card, galleryCss]) {
    const historic = execFileSync("git", ["show", `71fb28da5:${file}`], {
      encoding: "utf8",
    })
    assert.match(detect(historic, file).join(), /shared A4 ratio/, file)
  }
})

const canvasCss = "apps/web/src/features/paper-page/canvas.css"
const canvas = "apps/web/src/features/paper-page/canvas.tsx"

test("older Word canvas refuses responsive page geometry", () => {
  for (const source of [
    ".writing-page { padding-inline: clamp(1.25rem, 12%, 1in); }",
    ".writing-page { width: min(100% - 3rem, 8.5in); }",
    ".writing-scroll { grid-template-columns: min(100% - 3rem, 8.5in); }",
    "@container writing-sheet (width < 800px) { .writing-page p { font-size: 12pt; } }",
    "@media (max-width: 767px) { .writing-page { padding: 1rem; } }",
  ])
    assert.match(
      detect(source, canvasCss).join(),
      /scale the page in rich-page-layout.ts instead/
    )
  assert.ok(
    detect("if (scroll.clientWidth < 816) page.style.padding = '20px'", canvas)
      .length
  )
  assert.deepEqual(
    detect(
      ".writing-page { inline-size: 8.5in; min-block-size: 11in; padding: 1in; transform: scale(var(--cv-rich-page-scale)); }",
      canvasCss
    ),
    []
  )
  const historic = execFileSync("git", ["show", `646b7471:${canvasCss}`], {
    encoding: "utf8",
  })
  assert.ok(detect(historic, canvasCss).length)
})

test("shared viewport geometry preserves the lazy editor boundary", () => {
  const canvasViewport = "apps/web/src/features/paper-page/canvas-viewport.ts"
  const viewport = "packages/domain/src/paper-doc/paper-page-scale.ts"
  const message = /independent of the lazy letter editor/
  assert.match(
    detect(
      'import { scalePaperPage } from "@workspace/paper-crdt/page-viewport"',
      canvasViewport
    ).join(),
    message
  )
  for (const source of [
    'import { openRichPaperClient } from "@workspace/paper-crdt/editor"',
    'export { openRichPaperClient } from "@workspace/paper-crdt/editor"',
    'const editor = import("@workspace/paper-crdt/editor")',
  ])
    assert.match(detect(source, viewport).join(), message)
  assert.deepEqual(
    detect(
      'import { scalePaperPage } from "@workspace/domain/internal/paper-page-scale"',
      canvasViewport
    ),
    []
  )
  for (const file of [canvasViewport, viewport])
    assert.deepEqual(detect(readFileSync(file, "utf8"), file), [])
  const historic = execFileSync("git", ["show", `3f8f4170:${canvasViewport}`], {
    encoding: "utf8",
  })
  assert.match(detect(historic, canvasViewport).join(), message)
})

test("Word page border space cannot disappear with its chrome", () => {
  const message = /Keep the Word page's 1px border space/
  for (const border of [
    "border: 0",
    "border: 0px",
    "border: none",
    "border-width: 0",
    "border-style: none",
  ])
    assert.match(
      detect(`.writing-page { ${border}; }`, canvasCss).join(),
      message
    )
  for (const source of [
    ".writing-page { border: 1px solid transparent; }",
    ".writing-page { border: 1px solid var(--border); }",
    ".writing-page p { border: 0; }",
  ])
    assert.deepEqual(detect(source, canvasCss), [])
  const historic = execFileSync("git", ["show", `d04e2f15:${canvasCss}`], {
    encoding: "utf8",
  })
  assert.match(detect(historic, canvasCss).join(), message)
  assert.deepEqual(detect(readFileSync(canvasCss, "utf8"), canvasCss), [])
})
