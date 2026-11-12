import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { detectWebBlockCv as detect } from "./lib/web-block-cv.mjs"

const mistake = `async function applyTemplate(templateId) {
  const created = await run("paper.create", { kind: "cv", templateId })
  onCreated(created)
}`

const clean = `async function applyTemplate(templateId) {
  const created = await run("paper.canvas", { op: "mint", label: "cv", templateId })
  onMinted(created.docId)
}
async function draftLetter(jobId, lines) {
  return run("paper.canvas", { op: "mint", label: "letter", jobId, lines })
}`

test("the web never creates an older block CV or Letter", () => {
  assert.equal(detect(mistake).length, 1)
  assert.equal(detect(clean).length, 0)
  assert.equal(
    detect(`run("paper.create", { kind: "letter", name: "Cover letter" })`)
      .length,
    1
  )
  assert.equal(
    detect(`run("paper.create", { kind: "letter", templateId: "simple" })`)
      .length,
    1
  )
  assert.equal(detect(`run("paper.create", input)`).length, 1)
  assert.equal(
    detect(
      `await runContractCommand(queryClient, "paper.create", { kind: "letter", name })`
    ).length,
    1
  )
  assert.equal(
    detect(`const CREATE = "paper.create"
await runContractCommand(queryClient, CREATE, input)`).length,
    1
  )
  assert.equal(
    detect(`const CREATE = "paper.create" as const
const command = CREATE
await run(command, input)`).length,
    1
  )
  assert.equal(detect("run(`paper.create`, input)").length, 1)
  assert.equal(
    detect(`await fetch("/api/commands/paper.create", { method: "POST" })`)
      .length,
    1
  )
  assert.equal(
    detect(`const labels = { "paper.create": { label: "Create a Paper" } }
const CANVAS = "paper.canvas"
await runContractCommand(queryClient, CANVAS, input)
if (path === "/api/commands/paper.create") respond()`).length,
    0
  )
  const historic = execFileSync(
    "git",
    ["show", "1565bbf7:apps/web/src/features/paper/paper-new-dialog.tsx"],
    { encoding: "utf8" }
  )
  assert.equal(detect(historic).length, 2)
  const drafting = execFileSync(
    "git",
    ["show", "78a86b30:apps/web/src/features/paper/paper-letter-start.tsx"],
    { encoding: "utf8" }
  )
  assert.equal(detect(drafting).length, 1)
  const root = new URL("../apps/web/src/", import.meta.url)
  for (const path of readdirSync(root, { recursive: true })) {
    if (!/\.tsx?$/.test(path) || /\.test\.tsx?$/.test(path)) continue
    assert.deepEqual(
      detect(readFileSync(new URL(path, root), "utf8"), path),
      [],
      path
    )
  }
})
