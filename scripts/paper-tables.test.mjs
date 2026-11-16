import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { detect } from "./lib/paper-tables.mjs"

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
const files = [
  "packages/paper-crdt/src/editor.ts",
  "packages/paper-crdt/src/native-layout-flow-view.ts",
  "packages/paper-crdt/src/native-layout-schema.ts",
  "apps/web/src/features/paper/rich-table-controls.tsx",
  "apps/api/src/paper/native-output/formatted.ts",
]

test("table availability, row pagination and borders stay connected", () => {
  for (const file of files) assert.deepEqual(detect(read(file), file), [], file)
})

test("table mistakes fire and clean fixtures stay quiet", () => {
  const changes = [
    [
      files[0],
      "return apply(() => mounted.tables.insertTable(",
      "return mounted.tables.insertTable(",
    ],
    [
      files[1],
      'node.type === "photo"',
      'node.type === "table" || node.type === "photo"',
    ],
    [files[1], "paperRow]{break-inside:avoid", "paperRow]{break-inside:auto"],
    [
      files[1],
      "paper-oversized-row=true]{height:var(--paper-column-height);overflow:auto",
      "paper-oversized-row=true]{overflow:visible",
    ],
    [files[2], 'dom.style.height = "100%"', 'dom.style.height = "auto"'],
    [
      files[2],
      'if (block.type === "paperRow") dom.prepend(slot)',
      'if (block.type === "paperRow") dom.append(slot)',
    ],
    [
      files[2],
      'dom.style.border = "1px solid var(--border)"',
      'slot.style.boxShadow = "inset 0 0 0 1px var(--border)"',
    ],
    [files[3], "open={open && available}", "open={open}"],
    [files[3], "disabled={!available}", ""],
    [files[4], "<w:cantSplit/>", ""],
  ]
  for (const [file, from, to] of changes) {
    const clean = read(file)
    const mistake = clean.replace(from, to)
    assert.notEqual(mistake, clean, `${file}: missing fixture target`)
    assert.ok(detect(mistake, file).length, file)
    assert.deepEqual(detect(clean, file), [], file)
  }
})

test("the original table commit reproduces all three blocking mistakes", () => {
  for (const file of files.slice(0, 3)) {
    const historic = execFileSync("git", ["show", `212a5afd:${file}`], {
      encoding: "utf8",
    })
    assert.ok(detect(historic, file).length, file)
  }
})
