import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"

import {
  BLOCK_DOCUMENT_ONLY,
  detect,
  docIdFunctions,
} from "./lib/paper-one-kind.mjs"

const paperDir = new URL("../apps/api/src/paper/", import.meta.url)

const mistake = `
export async function renamePaper(actor: Actor, docId: PaperId, name: string) {
  const current = await ownedPaper(actor.userId, docId)
  await getDb().update(paperDocs).set({ name }).where(eq(paperDocs.id, current.id))
  return { ...toPaper({ ...current, name }), previousName: current.name }
}
`

const clean = `
export async function renamePaper(actor: Actor, docId: PaperId, name: string) {
  const current = await ownedPaperOrNull(actor.userId, docId)
  if (!current)
    return (await renameWordPage(actor.userId, docId, name)) ?? documentNotFound()
  await getDb().update(paperDocs).set({ name }).where(eq(paperDocs.id, current.id))
  return { ...toPaper({ ...current, name }), previousName: current.name }
}
`

test("a Paper command that reads only older documents fires", () => {
  assert.deepEqual(detect(mistake), [
    {
      kind: "paper-document-command-reads-one-kind",
      name: "renamePaper",
      line: 2,
    },
  ])
})

test("a Paper command that also reaches Word pages stays quiet", () => {
  assert.deepEqual(detect(clean), [])
})

test("every live Paper module reaches both kinds or names a block-only reason", () => {
  for (const file of readdirSync(paperDir)) {
    if (!file.endsWith(".ts") || file.includes(".test.")) continue
    const source = readFileSync(new URL(file, paperDir), "utf8")
    assert.deepEqual(detect(source, file), [], file)
  }
})

test("every block-only exemption names a live function that takes a document id", () => {
  const store = readFileSync(new URL("store.ts", paperDir), "utf8")
  const live = new Set(docIdFunctions(store))
  for (const [name, reason] of Object.entries(BLOCK_DOCUMENT_ONLY)) {
    assert.ok(live.has(name), `${name} is not a document function in store.ts`)
    assert.ok(reason.length > 20, name)
  }
})

test("the store that listed Word pages without their commands fires on rename, duplicate and delete", () => {
  const past = execFileSync(
    "git",
    ["show", "27ed7ad8:apps/api/src/paper/store.ts"],
    { cwd: new URL("../", import.meta.url), encoding: "utf8" }
  )
  const exemptAtThatTime = Object.fromEntries(
    [
      "setPaperTemplate",
      "setPaperStatus",
      "sharePaper",
      "unsharePaper",
      "dismissCheck",
      "keepTwoPages",
      "attachPhoto",
      "pageCount",
    ].map((name) => [name, "block document only at 27ed7ad8"])
  )
  assert.deepEqual(
    detect(past, "store.ts", exemptAtThatTime).map((finding) => finding.name),
    ["renamePaper", "duplicatePaper", "deletePaper"]
  )
})
