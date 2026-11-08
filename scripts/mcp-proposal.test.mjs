import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/mcp-proposal.mjs"

const actual = readFileSync(
  new URL("../apps/api/src/connections/http.ts", import.meta.url),
  "utf8"
)
const clean =
  'const result = { proposalId: value.pendingActionId, status: "pending approval", url: link }'
test("pending MCP responses expose the literal proposalId expected by clients", () => {
  assert.deepEqual(detect(clean), [])
  for (const mistake of [
    clean.replace("proposalId: value.pendingActionId, ", ""),
    clean.replace("value.pendingActionId", "value.chatId"),
  ]) {
    assert(
      detect(mistake).some((hit) => hit.kind === "missing-literal-proposal-id")
    )
  }
  assert.deepEqual(detect(actual), [])
})
