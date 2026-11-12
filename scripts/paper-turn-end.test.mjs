import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { detectPaperTurnEnd as detect } from "./lib/paper-turn-end.mjs"

const mistake = `async function draft() {
  await streamPaperTurn({ chatId, text, onText })
  const lines = letterLines(operation.text)
  await run("paper.canvas", { op: "mint", label: "letter", lines })
}`

const clean = `async function draft() {
  const end = await streamPaperTurn({ chatId, text, onText })
  if (end === "continuing")
    showText(await followPaperTurn({ queryClient, chatId, signal, onText }))
  await run("paper.canvas", { op: "mint", label: "letter", lines })
}`

test("a Paper Coach turn is saved only after it reports how it ended", () => {
  assert.equal(detect(mistake).length, 1)
  assert.equal(detect(clean).length, 0)
  assert.equal(detect("void streamPaperTurn(input)").length, 1)
  assert.equal(
    detect("async function draft() { await (api.streamPaperTurn(input)) }")
      .length,
    1
  )
  assert.equal(
    detect("return streamPaperTurn(input).then((end) => end)").length,
    0
  )
  assert.equal(
    detect(`async function fit() {
  await streamPaperTurn({ chatId, text, onText: () => undefined, onToolResult })
}`).length,
    0
  )
  assert.equal(
    detect(`async function draft() {
  await streamPaperTurn({ chatId, text, onText(delta) { shown += delta } })
}`).length,
    1
  )
  const historic = execFileSync(
    "git",
    ["show", "ca910609:apps/web/src/features/paper/paper-letter-start.tsx"],
    { encoding: "utf8" }
  )
  assert.equal(detect(historic).length, 1)
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
