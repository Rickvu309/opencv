import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import runTest from "node:test"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"
import { reachableFrom, reservedBefore } from "./lib/delegate-tool-binding.mjs"

function name(node) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return null
}

function contains(node, predicate) {
  if (predicate(node)) return true
  let found = false
  ts.forEachChild(node, (child) => {
    if (contains(child, predicate)) found = true
  })
  return found
}

function auditedTransaction(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isArrowFunction(parent) && !ts.isFunctionExpression(parent))
      continue
    const call = parent.parent
    if (!ts.isCallExpression(call) || name(call.expression) !== "transaction")
      continue
    return contains(
      parent.body,
      (candidate) =>
        ts.isAwaitExpression(candidate) &&
        ts.isCallExpression(candidate.expression) &&
        name(candidate.expression.expression) === "appendDelegateCall"
    )
  }
  return false
}

export function detect(text) {
  const source = ts.createSourceFile(
    "mcp.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const hits = []
  const hit = (node, message) =>
    hits.push({
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      message,
    })
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      /delegate.*limit|limit.*delegate/i.test(node.name.text) &&
      contains(
        node,
        (child) => ts.isNewExpression(child) && name(child.expression) === "Map"
      )
    )
      hit(node, "Count delegate calls in Postgres over a rolling minute")
    if (ts.isCallExpression(node) && name(node.expression) === "registerTool") {
      const handler = node.arguments.at(-1)
      if (
        handler &&
        (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))
      ) {
        const completes =
          reachableFrom(
            source,
            handler,
            (node) =>
              ts.isCallExpression(node) &&
              name(node.expression) === "completeDelegateCall"
          ).length > 0
        for (const { node: child, sites } of reachableFrom(
          source,
          handler,
          (node) =>
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.text === "registry" &&
            ["read", "execute"].includes(node.expression.name.text)
        )) {
          const chain = [...sites, child]
          if (chain.some(auditedTransaction)) continue
          if (reservedBefore(handler, chain[0].getStart(source)) && completes)
            continue
          hit(
            child,
            "Reserve a charged audit before product access and complete its outcome"
          )
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

const LOCAL = `export function createDelegateCallLimiter() {
  const connections = new Map()
  const owners = new Map()
  return (owner, connection) => {
    connections.set(connection, (connections.get(connection) ?? 0) + 1)
    owners.set(owner, (owners.get(owner) ?? 0) + 1)
  }
}`
const MISSING = `server.registerTool("job_list", {}, async (input) => {
  return transaction(async () => registry.read(entry.name, input, actor))
})`
const OUTSIDE = `server.registerTool("job_list", {}, async (input) => {
  const result = await transaction(async () => registry.execute({ name, input, actor }))
  await appendDelegateCall({ actor, input })
  return result
})`
const CLEAN = `server.registerTool("job_list", {}, async (input) => {
  return transaction(async () => {
    const window = await delegateCallWindow(actor)
    await requireLiveDelegate(actor)
    const result = window.allowed ? await registry.read(entry.name, input, actor) : null
    await appendDelegateCall({ actor, input, window, outcome: window.allowed ? "success" : "limited" })
    return result
  })
})`

function test(name, body) {
  if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  )
    return runTest(name, body)
}

test("a process-local delegate limiter is rejected", () =>
  assert.ok(detect(LOCAL).length > 0))
test("product access without an audit append is rejected", () =>
  assert.ok(detect(MISSING).length > 0))
test("an audit outside the product transaction is rejected", () =>
  assert.ok(detect(OUTSIDE).length > 0))
test("a durable window and atomic audit stay quiet", () =>
  assert.deepEqual(detect(CLEAN), []))
test("the live MCP binding and durable store stay quiet", () => {
  for (const file of [
    "../apps/api/src/connections/http.ts",
    "../apps/api/src/connections/call-store.ts",
  ])
    assert.deepEqual(
      detect(readFileSync(new URL(file, import.meta.url), "utf8")),
      []
    )
})

const RESERVED = `server.registerTool("tool", {}, async (input) => {
  const reservation = await transaction(async () => {
    const window = await delegateCallWindow(actor);
    await requireLiveDelegate(actor);
    return appendDelegateCall({ actor, window });
  });
  if (!reservation.allowed) throw new Error("limited");
  const result = await registry.execute({ name, input, actor });
  await transaction(() => completeDelegateCall(reservation.id, "pending"));
  return result;
})`

test("review preparation follows a durable charged reservation with a completed outcome", () => {
  assert.deepEqual(detect(RESERVED), [])
  for (const missing of [
    "await delegateCallWindow(actor);",
    "await requireLiveDelegate(actor);",
    "return appendDelegateCall({ actor, window });",
    'if (!reservation.allowed) throw new Error("limited");',
    'await transaction(() => completeDelegateCall(reservation.id, "pending"));',
  ])
    assert.ok(detect(RESERVED.replace(missing, "")).length > 0)
})

const liveDoor = readFileSync(
  new URL("../apps/api/src/connections/http.ts", import.meta.url),
  "utf8"
)

function mutate(text, from, to) {
  const changed = text.replace(from, to)
  assert.notEqual(changed, text, from)
  return changed
}

test("an unaudited read moved into a helper of the live binding is rejected", () => {
  const mutant = mutate(
    mutate(
      liveDoor,
      "export function connectionRoutes(",
      `async function readOutside(registry: Registry, name: string, input: unknown, actor: DelegateActor) {
  return { data: await registry.read(name, input, actor) }
}

export function connectionRoutes(`
    ),
    "            try {\n              const result = await transaction(",
    '            if (entry.kind === "query") return untrustedResult(await readOutside(registry, entry.name, input, actor))\n            try {\n              const result = await transaction('
  )
  assert.ok(detect(mutant).length > 0)
})
