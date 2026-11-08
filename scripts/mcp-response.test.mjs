import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { MessageChannel } from "node:worker_threads"
import test from "node:test"
import { detect, responseAdapter } from "./lib/mcp-response.mjs"

const clean = `async function route(c) {
  const handler = createMcpHandler(() => {})
  return handler.fetch(c.req.raw)
}`
const mistake = `async function route(c) {
  const handler = createMcpHandler(() => {})
  const response = await handler.fetch(c.req.raw)
  const body = await response.arrayBuffer()
  return new Response(body, {status: response.status, headers: response.headers})
}`
const actual = readFileSync(
  new URL("../apps/api/src/connections/http.ts", import.meta.url),
  "utf8"
)

async function firstEvent(text) {
  let controller
  const bytes = new TextEncoder().encode("event: message\ndata: ready\n\n")
  const stream = new ReadableStream({
    start(value) {
      controller = value
      controller.enqueue(bytes)
    },
  })
  const response = new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "mcp-protocol-version": "2026-07-28",
    },
  })
  const request = new Request("http://localhost/mcp", { method: "POST" })
  let delivered
  const result = responseAdapter(text)(
    {
      fetch: async (received) => {
        assert.equal(received, request)
        return response
      },
    },
    { req: { raw: request } },
    () => false
  ).then(async (forwarded) => {
    const event = await forwarded.body.getReader().read()
    delivered = { forwarded, event }
  })
  const { port1, port2 } = new MessageChannel()
  await new Promise((resolve) => {
    port1.once("message", resolve)
    port2.postMessage("stream observation checkpoint")
  })
  port1.close()
  port2.close()
  try {
    assert(delivered, "first SSE event must arrive before the stream closes")
  } finally {
    controller.close()
    await result
  }
  assert.equal(delivered.forwarded, response)
  assert.equal(delivered.forwarded.headers.get("cache-control"), "no-store")
  assert.equal(
    delivered.forwarded.headers.get("mcp-protocol-version"),
    "2026-07-28"
  )
  assert.deepEqual(delivered.event, { done: false, value: bytes })
}

test("buffering an ongoing MCP response prevents delivery of its first event", async () => {
  assert.equal(detect(mistake).length, 1)
  await assert.rejects(firstEvent(mistake), /first SSE event/)
})

test("direct streaming delivers the first event while the response remains open", async () => {
  assert.deepEqual(detect(clean), [])
  await firstEvent(clean)
})

test("the owning HTTP adapter streams the first event before stream closure", async () => {
  assert.deepEqual(detect(actual), [])
  await firstEvent(actual)
})

test("the adapter preserves cancellation and handler errors", async () => {
  let cancellation
  const upstream = new Response(
    new ReadableStream({
      cancel(reason) {
        cancellation = reason
      },
    })
  )
  const adapter = responseAdapter(actual)
  const c = { req: { raw: new Request("http://localhost/mcp") } }
  const forwarded = await adapter(
    { fetch: async () => upstream },
    c,
    () => false
  )
  assert.equal(forwarded, upstream)
  await forwarded.body.cancel("client disconnected")
  assert.equal(cancellation, "client disconnected")
  const failure = new Error("handler failure")
  await assert.rejects(
    adapter(
      {
        fetch: async () => {
          throw failure
        },
      },
      c,
      () => false
    ),
    (error) => error === failure
  )
})

test("the introducing ancestor buffers the first event until stream closure", async () => {
  const historic = execFileSync(
    "git",
    [
      "show",
      "a5c61cac383631d4837e65356d8f36cd424c69a6:apps/api/src/connections/http.ts",
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" }
  )
  assert.equal(detect(historic).length, 1)
  await assert.rejects(firstEvent(historic), /first SSE event/)
})
