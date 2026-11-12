import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { detectImportBlockPaper as detect } from "./lib/import-block-paper.mjs"

const mistake = `export async function importPaper(actor, fileId) {
  const parsed = await parseImportFile(file)
  return createPaper(actor, { kind: "cv", paper: parsed.document })
}`

const clean = `export async function importedWordPage(input) {
  const read = await parseImportFile(input)
  return { name: input.name, bytes: pageBytesOf(importedTextLines(read.text).lines) }
}`

const bindingMistake = `import { operation } from "@workspace/domain/operations/paper/import"
export const implementation = {
  operation,
  execute: (input, actor) => importPaper(actor, input.fileId),
}`

const bindingClean = `import { operation } from "@workspace/domain/operations/paper/import"
export const implementation = {
  operation,
  execute: (input, actor) => publishWordPackage(actor.userId, input.stageId),
}`

const insertMistake = `const importDraft = async () => getDb().insert(paperDocs).values(row)`

test("no import path creates an older block document", () => {
  assert.equal(detect(mistake, "store.ts").length, 1)
  assert.equal(detect(clean, "import-word.ts").length, 0)
  assert.equal(detect(bindingMistake, "server.ts").length, 1)
  assert.equal(detect(bindingClean, "server.ts").length, 0)
  assert.equal(detect(insertMistake, "store.ts").length, 1)
  assert.equal(
    detect(
      `export async function createPaper(actor) { return createPaper(actor) }`
    ).length,
    0
  )
  const historic = execFileSync(
    "git",
    ["show", "08e146e7:apps/api/src/paper/store.ts"],
    { encoding: "utf8" }
  )
  assert.ok(detect(historic, "store.ts").length >= 1)
  const paper = new URL("../apps/api/src/paper/", import.meta.url)
  for (const path of readdirSync(paper, { recursive: true })) {
    if (!/\.ts$/.test(path) || /\.test\.ts$/.test(path)) continue
    assert.deepEqual(
      detect(readFileSync(new URL(path, paper), "utf8"), path),
      [],
      path
    )
  }
})
