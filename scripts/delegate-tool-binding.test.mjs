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
  try {
    const reservation = await transaction(async () => {
      await delegateCallWindow(actor);
      await requireLiveDelegate(actor);
      return appendDelegateCall({ actor });
    });
    if (!reservation.allowed) throw new Error("limited");
    return entry.kind === "command" && registry.taskNeedsPreparation(entry.name, input)
      ? await registry.execute({ name: entry.name, input, actor })
      : await transaction(async () => {
          await requireLiveDelegate(actor);
          return entry.kind === "query"
            ? registry.read(entry.name, input, actor)
            : registry.execute({ name: entry.name, input, actor });
        });
  } catch (error) {
    return error;
  }
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

test("only a prepared review runs outside the checked transaction, after a charged live admission", () => {
  const unprepared = CLEAN.replace(
    'entry.kind === "command" && registry.taskNeedsPreparation(entry.name, input)',
    'entry.kind === "command"'
  )
  assert.notEqual(unprepared, CLEAN)
  assert.ok(detect(unprepared).length > 0)
  const unchecked = CLEAN.replace(
    "await requireLiveDelegate(actor);\n          return",
    "return"
  )
  assert.notEqual(unchecked, CLEAN)
  assert.ok(detect(unchecked).length > 0)
  for (const missing of [
    "await delegateCallWindow(actor);",
    "await requireLiveDelegate(actor);\n      return appendDelegateCall",
    "return appendDelegateCall({ actor });",
    'if (!reservation.allowed) throw new Error("limited");',
  ]) {
    const mistake = CLEAN.replace(
      missing,
      missing.includes("\n") ? "return appendDelegateCall" : ""
    )
    assert.notEqual(mistake, CLEAN)
    assert.ok(detect(mistake).length > 0, missing)
  }
})

test("the live binding stays quiet", () => {
  const text = readFileSync(
    path.join(root, "apps/api/src/connections/http.ts"),
    "utf8"
  )
  assert.deepEqual(detect(text), [])
})
