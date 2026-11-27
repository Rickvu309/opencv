import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"

import {
  PAPER_ENGINE_SOURCE,
  usesStockRebase,
} from "./lib/paper-collab-rebase.mjs"

const root = new URL("../", import.meta.url)

test("the stock collab rebase import fires", () => {
  assert.equal(
    usesStockRebase(
      'import { collab, receiveTransaction } from "prosemirror-collab"'
    ),
    true
  )
})

test("the collab plugin alone stays quiet", () => {
  assert.equal(
    usesStockRebase('import { collab } from "prosemirror-collab"'),
    false
  )
})

test("no Paper engine file rebases with the stock collab rebase", () => {
  const folder = new URL(`${PAPER_ENGINE_SOURCE}/`, root)
  const offenders = readdirSync(folder, { recursive: true })
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .filter((name) =>
      usesStockRebase(readFileSync(new URL(name, folder), "utf8"))
    )
  assert.deepEqual(offenders, [])
})
