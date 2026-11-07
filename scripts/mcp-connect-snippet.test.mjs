import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detect } from "./lib/mcp-connect-snippet.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const address = "https://api.example.com/mcp"

const SSE = `
export const command = "claude mcp add --transport sse opencv ${address}"
`

const BAD_URL = `
export const command = "claude mcp add --transport http opencv https://api.example.com/sse"
`

const CLEAN = `
export const claude = "claude mcp add --transport http opencv ${address}"
export const cursor = '{ "mcpServers": { "opencv": { "url": "${address}" } } }'
export const codex = "[mcp_servers.opencv]\\nurl = \\"${address}\\"\\nauth = \\"oauth\\""
`

test("an sse transport is rejected", () => {
  assert.ok(detect(SSE).some((hit) => hit.kind === "sse"))
})

test("a snippet url that is not /mcp is rejected", () => {
  assert.ok(detect(BAD_URL).some((hit) => hit.kind === "url"))
})

const OBJECT_SSE = `export const cursor = JSON.stringify({mcpServers:{opencv:{url:"https://api.example.com/sse"}}})`

const OBJECT_WRONG = `export const cursor = JSON.stringify({mcpServers:{opencv:{url:"https://api.example.com/other"}}})`

const OBJECT_CLEAN = `export const cursor = JSON.stringify({mcpServers:{opencv:{url:"${address}"}}})`

const OBJECT_FORCED = `
url.pathname = "/mcp"
export const cursor = JSON.stringify({mcpServers:{opencv:{url}}})
`

test("the http command, cursor url, and codex oauth table stay quiet", () => {
  assert.deepEqual(detect(CLEAN), [])
})

test("an object url whose path is /sse is rejected", () => {
  assert.ok(detect(OBJECT_SSE).some((hit) => hit.kind === "url"))
})

test("an object url whose path is not /mcp is rejected", () => {
  assert.ok(detect(OBJECT_WRONG).some((hit) => hit.kind === "url"))
})

test("a clean object url and a forced shorthand stay quiet", () => {
  assert.deepEqual(detect(OBJECT_CLEAN), [])
  assert.deepEqual(detect(OBJECT_FORCED), [])
})

test("the live snippet file stays quiet", () => {
  const live = readFileSync(
    path.join(root, "apps/web/src/features/connections/snippets.ts"),
    "utf8"
  )
  assert.deepEqual(detect(live), [])
})
