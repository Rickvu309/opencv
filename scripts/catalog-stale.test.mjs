import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/catalog-stale.mjs"

const fixture = (name) =>
  readFileSync(
    new URL(`./fixtures/catalog-stale/${name}.json`, import.meta.url),
    "utf8"
  )

test("the mistake fixture fires: #1370 changed the contract at 21f07dbe and kept the old catalog digest", () => {
  assert.deepEqual(detect(fixture("mistake")), [
    "packages/domain/src/generated/catalog.digest",
    "packages/domain/src/generated/catalog.ts",
  ])
})

test("the clean fixture stays quiet: the regenerated catalog of #1370 matches what generate writes", () => {
  assert.deepEqual(detect(fixture("clean")), [])
})

test("a generated file the catalog no longer writes is stale too", () => {
  const { expected } = JSON.parse(fixture("clean"))
  const leftover = "packages/domain/src/generated/old-catalog.ts"
  assert.deepEqual(
    detect(
      JSON.stringify({ expected, current: { ...expected, [leftover]: "x\n" } })
    ),
    [leftover]
  )
})

test("line endings alone do not make a catalog stale", () => {
  const { expected } = JSON.parse(fixture("clean"))
  const crlf = Object.fromEntries(
    Object.entries(expected).map(([file, text]) => [
      file,
      text.replace(/\n/g, "\r\n"),
    ])
  )
  assert.deepEqual(detect(JSON.stringify({ expected, current: crlf })), [])
})
