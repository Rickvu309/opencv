import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/paper-mint-names.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const paperDir = path.join(root, "apps/api/src/paper")

const mistake = `
const BLANK_PAGE_NAMES: Record<WordPageLabel, string> = {
  cv: "CV.docx",
  letter: "Cover letter.docx",
}

function mintedName(input: CanvasMint) {
  if (input.name)
    return /\\.docx$/i.test(input.name) ? input.name : \`\${input.name}.docx\`
  return BLANK_PAGE_NAMES[input.label]
}
`

const clean = `
const BLANK_PAGE_NAMES: Record<WordPageLabel, string> = {
  cv: "CV",
  letter: "Cover letter",
}

function mintedName(input: CanvasMint) {
  if (input.name) return input.name
  return BLANK_PAGE_NAMES[input.label]
}

function downloadFileName(name: string) {
  return \`\${name}.docx\`
}
`

function liveSources(dir) {
  return readdirSync(dir, { recursive: true })
    .filter(
      (file) => file.endsWith(".ts") && !/\.test\.|test-support/.test(file)
    )
    .map((file) => [file, readFileSync(path.join(dir, file), "utf8")])
}

test("a minted Paper name that ends in a file extension fires", () => {
  assert.deepEqual(
    detect(mistake).map(({ name, line }) => [name, line]),
    [
      ["BLANK_PAGE_NAMES", 3],
      ["BLANK_PAGE_NAMES", 4],
      ["mintedName", 9],
    ]
  )
})

test("plain minted names and a download file name stay quiet", () => {
  assert.deepEqual(detect(clean), [])
})

test("every live Paper module mints names without a file extension", () => {
  for (const [file, source] of liveSources(paperDir))
    assert.deepEqual(detect(source, file), [], file)
})

test("the canvas that minted CV.docx fires on its blank names", () => {
  const past = execFileSync(
    "git",
    ["show", "f8167a134:apps/api/src/paper/package-canvas.ts"],
    { cwd: root, encoding: "utf8" }
  )
  assert.deepEqual(
    detect(past).map(({ name, line }) => [name, line]),
    [
      ["BLANK_PAGE_NAMES", 33],
      ["BLANK_PAGE_NAMES", 34],
    ]
  )
})
