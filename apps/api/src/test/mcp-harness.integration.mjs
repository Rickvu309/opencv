import assert from "node:assert/strict"
import test from "node:test"
import { runHarness } from "../../../../scripts/mcp-harness.mjs"

test(
  "real clients discover, consent, read, propose, approve and refuse a revoked connection",
  { timeout: 300_000 },
  async () => {
    const result = await runHarness()
    assert(
      result.checks.some((check) =>
        check.includes("person approval, revoke, refusal")
      )
    )
    assert(
      result.checks.some((check) => check.includes("Seeded rolling boundary"))
    )
    assert(
      result.clients.some(
        (client) =>
          client.client.startsWith("MCP Inspector") &&
          client.status === "passed"
      )
    )
    console.log(JSON.stringify(result))
  }
)
