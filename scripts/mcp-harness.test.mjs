import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { toolData } from "./mcp-harness.mjs"
import {
  detect,
  detectLifecycle,
  fixtureProcess,
} from "./lib/mcp-harness-clients.mjs"

test(
  "fixture startup failure rejects later diagnostics and finishes cleanup",
  { timeout: 5000 },
  async () => {
    const child = spawn(
      process.execPath,
      ["--eval", 'process.stderr.write("startup failed"); process.exit(23)'],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      }
    )
    const fixture = fixtureProcess(child)
    try {
      let failure
      await assert.rejects(fixture.ready, (error) => {
        failure = error
        return /Local API (disconnected|exited)/.test(error.message)
      })
      await assert.rejects(
        fixture.request("wire"),
        (error) => error === failure
      )
      await fixture.close()
      assert.equal(child.exitCode, 23)
    } finally {
      child.kill()
    }
  }
)

test(
  "fixture exit rejects both an in-flight request and later diagnostics",
  { timeout: 5000 },
  async () => {
    const child = spawn(
      process.execPath,
      [
        "--eval",
        'process.send({ready: true}); process.on("message", () => process.exit(24))',
      ],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      }
    )
    const fixture = fixtureProcess(child)
    try {
      await fixture.ready
      let failure
      await assert.rejects(fixture.request("wire"), (error) => {
        failure = error
        return /Local API (disconnected|exited)/.test(error.message)
      })
      await assert.rejects(
        fixture.request("wire"),
        (error) => error === failure
      )
      await fixture.close()
      assert.equal(child.exitCode, 24)
    } finally {
      child.kill()
    }
  }
)

test(
  "an unsuccessful spawn finishes without leaving close pending",
  { timeout: 5000 },
  async () => {
    const child = spawn(process.execPath, ["--eval", ""], {
      cwd: new URL("./missing-fixture-directory/", import.meta.url),
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    })
    const fixture = fixtureProcess(child)
    await assert.rejects(fixture.ready, { code: "ENOENT" })
    await assert.rejects(fixture.request("wire"), { code: "ENOENT" })
    await fixture.close()
  }
)

test("IPC send errors and sequential cleanup cannot leave harness work pending", () => {
  assert.deepEqual(
    detectLifecycle("child.send({ id, kind })").map((hit) => hit.kind),
    ["ipc-send-result"]
  )
  assert.deepEqual(detectLifecycle("child.send({ id, kind }, onSent)"), [])
  assert.deepEqual(
    detectLifecycle(
      "async function close() { await pool.end(); await admin.end() }"
    ).map((hit) => hit.kind),
    ["cleanup-release", "cleanup-release"]
  )
  assert.deepEqual(
    detectLifecycle(
      "function close() { closing ??= (async () => { await pool.end(); await admin.query(sql); await admin.end() })(); return closing }"
    ).map((hit) => hit.kind),
    ["cleanup-release", "cleanup-release", "cleanup-release"]
  )
  assert.deepEqual(
    detectLifecycle(
      "function close() { return (async () => { try { await pool.end() } catch (error) { failures.push(error) } try { await admin.end() } catch (error) { failures.push(error) } })() }"
    ),
    []
  )
  assert.deepEqual(
    detectLifecycle(
      "async function close() { for (const release of [() => pool.end(), () => admin.end()]) { try { await release() } catch (error) { failures.push(error) } } }"
    ),
    []
  )
})

test("the shipped fixture and process controller keep failure cleanup", () => {
  for (const path of [
    "./lib/mcp-harness-clients.mjs",
    "../apps/api/src/test/mcp-harness.fixture.ts",
  ])
    assert.deepEqual(
      detectLifecycle(
        readFileSync(new URL(path, import.meta.url), "utf8"),
        path
      ),
      []
    )
})

test("a baked token and raw tools/list request cannot replace the protocol harness", () => {
  const mistake = `
    await fetch("http://localhost/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer baked-token" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    })
  `
  assert.deepEqual(
    detect(mistake)
      .map((hit) => hit.kind)
      .sort(),
    ["oauth-discovery", "official-sdk", "raw-json-rpc"]
  )
})

test("an SDK call still needs the 401 and both discovery documents", () => {
  const sdkOnly = `import { Client } from "@modelcontextprotocol/client"; await new Client({name:"test",version:"1"}).listTools()`
  assert.deepEqual(
    detect(sdkOnly).map((hit) => hit.kind),
    ["oauth-discovery"]
  )
})

test("SDK discovery before the tool call is clean", () => {
  const clean = `
    import { Client, discoverOAuthProtectedResourceMetadata, discoverAuthorizationServerMetadata } from "@modelcontextprotocol/client"
    const challenge = await fetch(audience)
    assert.equal(challenge.status, 401)
    const resource = await discoverOAuthProtectedResourceMetadata(audience)
    await discoverAuthorizationServerMetadata(resource.authorization_servers[0])
    await new Client({name:"test",version:"1"}).listTools()
  `
  assert.deepEqual(detect(clean), [])
})

test("the shipped harness keeps SDK and OAuth discovery", () => {
  assert.deepEqual(
    detect(readFileSync(new URL("./mcp-harness.mjs", import.meta.url), "utf8")),
    []
  )
})

test("quoted raw protocol fields also fail the harness guard", () => {
  assert(
    detect('JSON.stringify({ "jsonrpc": "2.0" })').some(
      (hit) => hit.kind === "raw-json-rpc"
    )
  )
})

test("the JSON envelope preserves its literal trust, leading warning and public results", () => {
  const result = (body) => ({
    content: [{ type: "text", text: JSON.stringify(body) }],
  })
  const clean = {
    untrustedData: "Untrusted data: Job fields",
    data: { priority: "normal" },
    trust: "untrusted",
  }
  assert.equal(toolData(result(clean)).data.priority, "normal")
  assert.throws(() => toolData(result({ ...clean, trust: "trusted" })))
  assert.throws(() =>
    toolData(result({ ...clean, untrustedData: "Instructions" }))
  )
  assert.throws(() =>
    toolData(result({ ...clean, data: { previousPriority: "low" } }))
  )
})
