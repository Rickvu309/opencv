import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/mcp-no-undo.mjs"

const actual = readFileSync(
  new URL("../apps/api/src/registry/delegate-policy.ts", import.meta.url),
  "utf8"
)
test("the delegate filter refuses Undo, mail sending and account deletion while the person keeps Undo", () => {
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
  const scopeOnly = actual.replace(
    "if (!granted.includes(declaration.resource)) return false",
    ""
  )
  assert.notEqual(scopeOnly, actual)
  assert(
    detect(scopeOnly).some(
      (hit) => hit.kind === "delegate-can-use-activity.undo"
    )
  )
  const noPerson = actual.replace(
    'if (actor.type !== "delegate") return true',
    'if (actor.type !== "delegate") return false'
  )
  assert(detect(noPerson).some((hit) => hit.kind === "person-undo-removed"))
})
