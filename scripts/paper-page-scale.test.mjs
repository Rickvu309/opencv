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
    ],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
  for (const file of files)
    assert.deepEqual(detect(readFileSync(file, "utf8"), file), [], file)
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
