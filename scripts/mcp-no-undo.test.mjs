import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/mcp-no-undo.mjs"

const actual = readFileSync(
  new URL("../apps/api/src/registry/delegate-policy.ts", import.meta.url),
  "utf8"
)
test("the delegate filter refuses Undo, approval, restore, sync, canvas, mail and account commands whatever marker they carry while the person keeps Undo", () => {
  assert.deepEqual(detect(actual), [])
  for (const name of ["activity.undo", "inbox.send", "account.delete"]) {
    const mistake = actual.replace(
      'if (actor.type !== "delegate") return true',
      `if (entry.name === "${name}") return true\n  if (actor.type !== "delegate") return true`
    )
    assert.notEqual(mistake, actual)
    assert(
      detect(mistake).some((hit) => hit.kind === `delegate-can-use-${name}`)
    )
  }
  const listedUndo = actual.replace(
    '["job.list", "read"],',
    '["job.list", "read"],\n  ["activity.undo", "proposal"],'
  )
  assert.notEqual(listedUndo, actual)
  assert(
    detect(listedUndo).some(
      (hit) => hit.kind === "delegate-reachable-lists-activity.undo"
    )
  )
  const listedWordUndo = actual.replace(
    '["paper.edit", "proposal"],',
    '["paper.edit", "proposal"],\n  ["paper.undoWord", "proposal"],'
  )
  assert.notEqual(listedWordUndo, actual)
  const wordUndoHits = detect(listedWordUndo).map((hit) => hit.kind)
  assert(wordUndoHits.includes("delegate-reachable-lists-paper.undoWord"))
  assert(wordUndoHits.includes("delegate-can-use-paper.undoWord"))
  const markerOnly = actual
    .replace("if (!access) return false", "")
    .replace("declaration.access !== access", "false")
  assert.notEqual(markerOnly, actual)
  const markerOnlyHits = detect(markerOnly).map((hit) => hit.kind)
  assert(markerOnlyHits.includes("delegate-can-use-paper.undoWord"))
  const anyOwner = markerOnly.replace(
    "declaration.resource !== resource ||",
    ""
  )
  assert.notEqual(anyOwner, markerOnly)
  const anyOwnerHits = detect(anyOwner).map((hit) => hit.kind)
  for (const name of ["activity.undo", "inbox.send", "account.delete"])
    assert(anyOwnerHits.includes(`delegate-can-use-${name}`))
  const noSet = actual.replace("const DELEGATE_REACHABLE", "const REACHABLE")
  assert(
    detect(noSet).some((hit) => hit.kind === "missing-delegate-reachable-set")
  )
  const noPerson = actual.replace(
    'if (actor.type !== "delegate") return true',
    'if (actor.type !== "delegate") return false'
  )
  assert(detect(noPerson).some((hit) => hit.kind === "person-undo-removed"))
})
