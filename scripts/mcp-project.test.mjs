import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/mcp-project.mjs"

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
const http = read("apps/api/src/connections/http.ts")
const policy = read("apps/api/src/registry/delegate-policy.ts")
const clean = `const entries = await registry.tools(actor)
for (const entry of entries) server.registerTool(entry.name, {}, handler)`

test("MCP tools project registry metadata instead of a handwritten name list", () => {
  assert.deepEqual(detect(clean), [])
  assert(
    detect(`const names = ["job_get", "job_list"]; ${clean}`).some(
      (hit) => hit.kind === "handwritten-tool-list"
    )
  )
  assert(
    detect(`${clean}; server.registerTool("job_get", {}, handler)`).some(
      (hit) => hit.kind === "handwritten-tool-registration"
    )
  )
  assert(
    detect(`const entries = otherTools(actor)`).some(
      (hit) => hit.kind === "missing-registry-projection"
    )
  )
  assert.deepEqual(detect(http), [])
})

test("delegate projection requires both declared metadata and its access scope", () => {
  assert.deepEqual(detect(policy, "delegate-policy.ts"), [])
  for (const expression of [
    "actor.scopes.includes(`${declaration.resource}.read`)",
    "actor.scopes.includes(`${declaration.resource}.write`)",
    "if (!declaration) return false",
  ]) {
    const mistake = policy.replace(
      expression,
      expression.startsWith("if") ? "" : "true"
    )
    assert.notEqual(mistake, policy)
    assert(
      detect(mistake, "delegate-policy.ts").some(
        (hit) => hit.kind === "delegate-without-declared-scope"
      )
    )
  }
})
