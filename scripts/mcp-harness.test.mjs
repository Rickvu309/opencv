import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { toolData } from "./mcp-harness.mjs"
import { detect } from "./lib/mcp-harness-clients.mjs"

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
