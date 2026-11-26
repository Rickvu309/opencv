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

const liveDoor = readFileSync(
  path.join(root, "apps/api/src/connections/http.ts"),
  "utf8"
)

function mutate(text, from, to) {
  const changed = text.replace(from, to)
  assert.notEqual(changed, text, from)
  return changed
}

const READ_OUTSIDE = `async function readOutside(registry: Registry, name: string, input: unknown, actor: DelegateActor) {
  return { data: await registry.read(name, input, actor) }
}

export function connectionRoutes(`

const HELPER_OUTSIDE = `
async function readOutside(registry, name, input, actor) {
  return { data: await registry.read(name, input, actor) }
}
server.registerTool("job_get", {}, async (input) => {
  if (entry.kind === "query") return readOutside(registry, entry.name, input, actor)
  return transaction(async () => {
    await requireLiveDelegate(actor)
    return registry.execute({ name: entry.name, input, actor })
  })
})
`

const HELPER_INSIDE = `
async function readChecked(registry, name, input, actor) {
  return { data: await registry.read(name, input, actor) }
}
server.registerTool("job_get", {}, async (input) =>
  transaction(async () => {
    await requireLiveDelegate(actor)
    return readChecked(registry, entry.name, input, actor)
  })
)
`

test("a read moved into a helper called before the checked transaction is rejected", () => {
  assert.ok(detect(HELPER_OUTSIDE).length > 0)
  assert.deepEqual(detect(HELPER_INSIDE), [])
  const unchecked = HELPER_INSIDE.replace(
    "await requireLiveDelegate(actor)\n",
    ""
  )
  assert.notEqual(unchecked, HELPER_INSIDE)
  assert.ok(detect(unchecked).length > 0)
})

test("the reviewer's helper bypass in the live binding is rejected", () => {
  const mutant = mutate(
    mutate(liveDoor, "export function connectionRoutes(", READ_OUTSIDE),
    "            try {\n              const result = await transaction(",
    '            if (entry.kind === "query") return untrustedResult(await readOutside(registry, entry.name, input, actor))\n            try {\n              const result = await transaction('
  )
  assert.ok(detect(mutant).length > 0)
})

test("the live door marks a call checked only after it re-checks the connection", () => {
  for (const [from, to] of [
    [
      "await requireLiveDelegate(actor)\n                        checked = true",
      "checked = true",
    ],
  ])
    assert.ok(detect(mutate(liveDoor, from, to)).length > 0, from)
})

function checkedTool(body, before = "") {
  return `${before}
server.registerTool("job_get", {}, async (input) =>
  transaction(async () => {
    await requireLiveDelegate(actor)
    return ${body}
  })
)
`
}

test("the door reaches the registry and database only through checked calls", () => {
  assert.deepEqual(
    detect(checkedTool("registry.read(entry.name, input, actor)")),
    []
  )
  for (const [rule, mistake] of [
    [
      "registry-escape",
      checkedTool(
        "reader.read(entry.name, input, actor)",
        "const reader = registry"
      ),
    ],
    [
      "registry-escape",
      checkedTool(
        "readAs(registry, entry.name, input, actor)",
        "async function readAs(source, name, input, actor) { return source.read(name, input, actor) }"
      ),
    ],
    ["registry-escape", checkedTool("run({ registry, input })")],
    ["door-database", checkedTool("db.select().from(jobs)")],
    [
      "door-database-import",
      checkedTool(
        "getDb().select().from(jobs)",
        'import { getDb } from "../db/context.js"'
      ),
    ],
    [
      "door-database-import",
      checkedTool("jobs", 'import { jobs } from "../db/schema.js"'),
    ],
    [
      "door-import",
      checkedTool(
        "listJobs(actor.userId)",
        'import { listJobs } from "../jobs/index.js"'
      ),
    ],
    [
      ["helper-escape", "registry-escape"],
      checkedTool(
        "later(registry, entry.name, input, actor)",
        "async function readOutside(registry, name, input, actor) { return registry.read(name, input, actor) }\nconst later = readOutside"
      ),
    ],
  ])
    assert.deepEqual(
      detect(mistake).map((hit) => hit.rule),
      [rule].flat(),
      mistake
    )
})
