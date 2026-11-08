import assert from "node:assert/strict"
import { once } from "node:events"
import { createServer } from "node:net"
import { createRequire } from "node:module"
import test from "node:test"
import { runHarness } from "../../../../scripts/mcp-harness.mjs"

test(
  "an occupied listener releases the failed fixture's own database",
  { timeout: 60_000 },
  async () => {
    assert.ok(
      process.env.FORMAL_DATABASE_URL,
      "FORMAL_DATABASE_URL is required"
    )
    const { Pool } = createRequire(import.meta.url)("pg")
    const admin = new Pool({
      connectionString: process.env.FORMAL_DATABASE_URL,
      max: 1,
    })
    const occupied = createServer()
    const names = async () =>
      new Set(
        (
          await admin.query(
            "SELECT datname FROM pg_database WHERE starts_with(datname, 'mcp_harness_')"
          )
        ).rows.map((row) => row.datname)
      )
    let before
    try {
      before = await names()
      occupied.listen(0, "127.0.0.1")
      await once(occupied, "listening")
      await assert.rejects(
        runHarness({ port: occupied.address().port, clients: false }),
        /EADDRINUSE/
      )
      assert.deepEqual(await names(), before)
    } finally {
      const failures = []
      for (const release of [
        async () => {
          if (!occupied.listening) return
          await new Promise((resolve, reject) =>
            occupied.close((error) => (error ? reject(error) : resolve()))
          )
        },
        () => admin.end(),
      ]) {
        try {
          await release()
        } catch (error) {
          failures.push(error)
        }
      }
      if (failures.length)
        throw new AggregateError(
          failures,
          "Occupied-listener test cleanup failed"
        )
    }
  }
)

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
