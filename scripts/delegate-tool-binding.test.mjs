import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detect } from "./lib/delegate-tool-binding.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const SPLIT = `
server.registerTool("job_get", {}, async (input) => {
  await transaction(async () =>
    entry.kind === "query"
      ? { data: await registry.read(entry.name, input, actor) }
      : registry.execute({ name: entry.name, input, actor })
  )
})
`

const OUTSIDE = `
server.registerTool("job_get", {}, async (input) => {
  await requireLiveDelegate(actor)
  await transaction(async () => registry.read(entry.name, input, actor))
})
`

const CLEAN = `
server.registerTool("job_get", {}, async (input) => {
  const reservation = await transaction(async () => {
    await delegateCallWindow(actor);
    await requireLiveDelegate(actor);
    return appendDelegateCall({ actor });
  });
  if (!reservation.allowed) throw new Error("limited");
  return entry.kind === "query"
    ? await transaction(async () => { await requireLiveDelegate(actor); return registry.read(entry.name, input, actor); })
    : registry.execute({ name: entry.name, input, actor });
})
`

test("a tool transaction that does not re-check the connection is rejected", () => {
  assert.ok(detect(SPLIT).length > 0)
})

test("a check outside the tool transaction is rejected", () => {
  assert.ok(detect(OUTSIDE).length > 0)
})

test("a check inside the tool transaction stays quiet", () => {
  assert.deepEqual(detect(CLEAN), [])
})

test("reviewed execution stays outside a transaction after a charged live admission", () => {
  assert.ok(
    detect(
      CLEAN.replace(
        "registry.execute({ name: entry.name, input, actor })",
        "transaction(async () => registry.execute({ name: entry.name, input, actor }))"
      )
    ).length > 0
  )
  for (const missing of [
    "await delegateCallWindow(actor);",
    "await requireLiveDelegate(actor);",
    "return appendDelegateCall({ actor });",
    'if (!reservation.allowed) throw new Error("limited");',
  ])
    assert.ok(detect(CLEAN.replace(missing, "")).length > 0)
})

test("the live binding stays quiet", () => {
  const text = readFileSync(
    path.join(root, "apps/api/src/connections/http.ts"),
    "utf8"
  )
  assert.deepEqual(detect(text), [])
})
