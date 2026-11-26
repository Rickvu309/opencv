import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-measured-pagination.mjs"
import { pathAtRevision } from "./lib/path-at-revision.mjs"

const file = "packages/paper-crdt/src/native-layout-flow-view.ts"
const geometry =
  "apps/web/src/features/paper/rich-editor/rich-page-geometry.css"

test("Paper page backgrounds tile without Firefox repeating-gradient artifacts", () => {
  assert.equal(
    detect(
      "background: repeating-linear-gradient(to bottom, white, gray)",
      geometry
    ).length,
    1
  )
  assert.deepEqual(
    detect(
      "background: linear-gradient(to bottom, white, gray); background-size:100% var(--cv-rich-page-pitch); background-repeat:repeat-y",
      geometry
    ),
    []
  )
  for (const revision of ["f66e65e0", "64de35c6"]) {
    const historic = execFileSync(
      "git",
      ["show", `${revision}:${pathAtRevision(revision, geometry)}`],
      {
        encoding: "utf8",
      }
    )
    assert.equal(detect(historic, geometry).length, 1)
  }
  assert.deepEqual(detect(readFileSync(geometry, "utf8"), geometry), [])
})

test("Paper pagination refuses experimental columns and photo exclusions", () => {
  for (const source of [
    "CSS.supports('column-wrap', 'wrap')",
    "slot {column-height: 864px; column-wrap:wrap}",
    'function flowPaginationSupport(doc) { if (doc.children.some(node => node.type === "photo")) return {supported:false} }',
  ])
    assert.ok(detect(source, file).length, source)
  for (const source of [
    "const offsets = measuredPageBreaks(lines, page)",
    "function flowPaginationSupport(doc) { return {supported:true} }",
    "slot {column-count:1}",
    "slot {height:var(--paper-column-height);--paper-column-height:864px}",
  ])
    assert.deepEqual(detect(source, file), [], source)
})

test("the column-based fork fails and measured Paper pagination stays quiet", () => {
  for (const revision of ["468dda36", "64de35c6"]) {
    const historic = execFileSync(
      "git",
      ["show", `${revision}:${pathAtRevision(revision, file)}`],
      {
        encoding: "utf8",
      }
    )
    assert.equal(detect(historic, file).length, 3)
  }
  for (const name of readdirSync("packages/paper-crdt/src").filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")
  )) {
    const path = `packages/paper-crdt/src/${name}`
    assert.deepEqual(detect(readFileSync(path, "utf8"), path), [], path)
  }
})

test("Word break properties and Find settling reject their introducing commit", () => {
  for (const [path, from, to] of [
    [
      "packages/paper-crdt/src/native-layout-text-lines.ts",
      "properties.widowOrphan !== false",
      "false",
    ],
    [
      "packages/paper-crdt/src/native-layout-search.ts",
      "if (active) scroll()",
      "scrollFrame = 0",
    ],
  ]) {
    const clean = readFileSync(path, "utf8")
    assert.deepEqual(detect(clean, path), [])
    const mistake = clean.replace(from, to)
    assert.notEqual(mistake, clean)
    assert.equal(detect(mistake, path).length, 1)
    const historicPath = path.replace(
      "native-layout-text-lines",
      "measured-flow-pagination"
    )
    const historic = execFileSync(
      "git",
      ["show", `68bd981a:${pathAtRevision("68bd981a", historicPath)}`],
      {
        encoding: "utf8",
      }
    )
    assert.equal(
      detect(historic, path).length,
      path.endsWith("native-layout-text-lines.ts") ? 2 : 1
    )
  }
})

test("semantic owners, visual lines and typing reject the reviewed regression", () => {
  const file = "packages/paper-crdt/src/native-layout-measured-pagination.ts"
  const clean = readFileSync(file, "utf8")
  assert.deepEqual(detect(clean, file), [])
  for (const [from, to] of [
    ["node.childCount > 1", "false"],
    ['"data-paper-oversized-block": "true"', '"data-paper-clip": "true"'],
    ['contenteditable: "false"', 'contenteditable: "inherit"'],
    ["pass < 4", "false"],
    ["updates.every", "updates.some"],
  ]) {
    const mistake = clean.replace(from, to)
    assert.notEqual(mistake, clean)
    assert.equal(detect(mistake, file).length, 1)
  }
  const historic = execFileSync(
    "git",
    ["show", `655f6a7b:${pathAtRevision("655f6a7b", file)}`],
    {
      encoding: "utf8",
    }
  )
  assert.equal(detect(historic, file).length, 5)
})

test("pagination yields the input frame before measuring browser layout", () => {
  const clean = readFileSync(file, "utf8")
  assert.deepEqual(detect(clean, file), [])
  const mistake = clean.replace(
    ["afterPaint = window.set", "Timeout"].join(""),
    "afterPaint = run"
  )
  assert.notEqual(mistake, clean)
  assert.equal(detect(mistake, file).length, 1)
  const historic = execFileSync(
    "git",
    ["show", `655f6a7b:${pathAtRevision("655f6a7b", file)}`],
    {
      encoding: "utf8",
    }
  )
  assert.equal(detect(historic, file).length, 1)
})

test("visual line overlap cannot regress to top-coordinate grouping", () => {
  const file = "packages/paper-crdt/src/native-layout-text-lines.ts"
  const clean = readFileSync(file, "utf8")
  assert.deepEqual(detect(clean, file), [])
  const mistake = clean.replace(
    "Math.min(previous.bottom, bottom) - Math.max(previous.top, top)",
    "Math.abs(previous.top - top)"
  )
  assert.notEqual(mistake, clean)
  assert.equal(detect(mistake, file).length, 1)
})

test("oversized keyboard scrolling rejects the reviewed focus loss", () => {
  const file = "packages/paper-crdt/src/native-layout-flow-mount.ts"
  const clean = readFileSync(file, "utf8")
  assert.deepEqual(detect(clean, file), [])
  const mistake = clean.replace("scrollOversizedContent(event)", "false")
  assert.notEqual(mistake, clean)
  assert.equal(detect(mistake, file).length, 1)
  const historic = execFileSync(
    "git",
    ["show", `655f6a7b:${pathAtRevision("655f6a7b", file)}`],
    {
      encoding: "utf8",
    }
  )
  assert.equal(detect(historic, file).length, 1)
})

test("oversized rows retain region focus and editable cells", () => {
  const clean = readFileSync(file, "utf8")
  for (const from of [
    'row.contentEditable = "false"',
    'content.contentEditable = "true"',
  ]) {
    const mistake = clean.replace(from, "")
    assert.notEqual(mistake, clean)
    assert.equal(detect(mistake, file).length, 1)
  }
  const historic = execFileSync(
    "git",
    ["show", `655f6a7b:${pathAtRevision("655f6a7b", file)}`],
    {
      encoding: "utf8",
    }
  )
  assert.equal(detect(historic, file).length, 1)
})
