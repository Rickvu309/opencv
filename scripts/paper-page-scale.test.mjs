import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-page-scale.mjs"
import { pathAtRevision } from "./lib/path-at-revision.mjs"

const css = "apps/web/src/features/paper/editor/paper-editor.css"
const editor = "apps/web/src/features/paper/editor/paper-editor.ts"
const painter = "apps/web/src/features/paper/editor/painter.ts"
const remedy = /scale the page with pageScale in painter.ts instead/
const fitLine = "    scale = pageScale(width - 2 * gutter, widthPx)\n"

test("responsive Paper geometry mistakes fail with the scaling remedy", () => {
  for (const query of [
    "@media (max-width: 767px)",
    "@container paper (inline-size < 800px)",
  ]) {
    for (const selector of [
      ".paper-editor-page",
      ".paper-editor-stage",
      ".paper-editor-page .paper-run",
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
          remedy
        )
      }
    }
  }
  assert.match(
    detect(".paper-editor-page { width: 100%; }", css).join(),
    remedy
  )
  for (const [file, source] of [
    [painter, "const reflow = available < width"],
    [editor, "if (host.clientWidth < pageWidth) stage.style.padding = '20px'"],
    [editor, "host.dataset.paperCompact = String(available < pageWidth)"],
    [
      editor,
      "host.setAttribute('data-paper-mobile', String(innerWidth < 800))",
    ],
    [
      editor,
      "const narrow = window.innerWidth < 800; if (narrow) host.classList.add('compact')",
    ],
    [editor, "element.dataset.paperReflow = 'false'"],
    [editor, "layout = layouter.layout(doc, { widthPx: host.clientWidth })"],
    [
      "packages/paper-engine/src/layout/break-lines.ts",
      "page.dataset.paperReflow = String(width < 600)",
    ],
  ])
    assert.match(detect(source, file).join(), remedy, source)
})

test("uniform scaling and responsive chrome stay quiet", () => {
  for (const source of [
    ".paper-editor-stage { position: absolute; transform-origin: 0 0; }",
    "@media (max-width: 767px) { .paper-toolbar { padding: 12px; } }",
    "@media (max-width: 480px), (pointer: coarse) { .paper-photo-handle { width: 44px; height: 44px; } }",
    "@media (prefers-reduced-motion: reduce) { .paper-editor-page { transition: none; } }",
    "@media print { .paper-chrome .paper-editor-stage { position: static; transform: none !important; } }",
    "@media (hover: hover) { .paper-editor-page button { background: var(--muted); } }",
  ])
    assert.deepEqual(detect(source, css), [], source)
  assert.deepEqual(
    detect(
      "const width = host.clientWidth; const gutter = width < NARROW_PX ? 16 : 32; scale = pageScale(width - 2 * gutter, widthPx); stage.style.transform = `scale(${scale})`",
      editor
    ),
    []
  )
  assert.deepEqual(
    detect(
      "if (row.clientWidth < need) row.classList.add('folded')",
      "apps/web/src/features/paper/editor/chrome/toolbar-fold.ts"
    ),
    []
  )
})

test("the editor scales a fixed-width page and current Paper sources pass", () => {
  const fit = readFileSync(editor, "utf8")
  assert.ok(fit.includes(fitLine))
  assert.match(fit, /stage\.style\.width = `\$\{widthPx\}px`/)
  assert.match(fit, /scale\(\$\{scale\}\)`/)
  assert.match(
    readFileSync(painter, "utf8"),
    /export function pageScale\(availablePx: number, widthPx: number\): number \{\n  return Math\.min\(1, Math\.max\(0\.1, availablePx \/ widthPx\)\)\n\}/
  )
  assert.deepEqual(detect(fit, editor), [])
  assert.match(
    detect(
      fit.replace(
        fitLine,
        "    const reflow = width < widthPx\n    if (reflow) stage.style.width = `${width}px`\n"
      ),
      editor
    ).join(),
    remedy
  )
  const files = execFileSync(
    "git",
    ["ls-files", "apps/web/src/features/paper", "packages/paper-engine/src"],
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
    const historic = execFileSync(
      "git",
      ["show", `71fb28da5:${pathAtRevision("71fb28da5", file)}`],
      {
        encoding: "utf8",
      }
    )
    assert.match(detect(historic, file).join(), /shared A4 ratio/, file)
  }
})
