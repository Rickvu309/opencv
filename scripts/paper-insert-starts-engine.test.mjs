import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/paper-insert-starts-engine.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const STORE = "apps/api/src/paper/store.ts"
const FORK = "aec0255c7"

const MISTAKE = `
export async function createPaper(
  actor: Actor,
  input: { kind: PaperStoredKind; name?: string }
) {
  const id = createId()
  await getDb()
    .insert(paperDocs)
    .values({ id, userId: actor.userId, kind: input.kind, ...seedColumns(input.kind, paper) })
  return readPaperDocumentInfo(actor.userId, parsePaperId(id))
}

export async function createEngineImportPage(owner: UserId, page: Document) {
  const id = createId()
  await getDb().insert(paperDocs).values({ id, userId: owner })
  admitted(await engineLog.start(id, page))
  return id
}
`

const CLEAN = `
export async function createPaper(
  actor: Actor,
  input: { kind: PaperStoredKind; page: Document }
) {
  const id = createId()
  const inserted = await getDb()
    .insert(paperDocs)
    .values({ id, userId: actor.userId, kind: input.kind })
    .returning({ id: paperDocs.id })
  if (inserted.length) admitted(await engineLog.start(id, input.page))
  return id
}
`

test("a store function that inserts a Paper row without starting its log fires", () => {
  const problems = detect(MISTAKE, STORE)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /in createPaper without engineLog\.start/)
})

test("a store function that starts the log for the row it inserts stays quiet", () => {
  assert.deepEqual(detect(CLEAN, STORE), [])
})

test("test files may seed Paper rows directly", () => {
  assert.deepEqual(detect(MISTAKE, "apps/api/src/paper/store.test.ts"), [])
  assert.deepEqual(detect(MISTAKE, "apps/api/src/test/paper-row.ts"), [])
})

test("the fork point, where paper.start and paper.duplicate made engine 1 Papers, fires", () => {
  const past = execFileSync("git", ["show", `${FORK}:${STORE}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  assert.ok(detect(past, STORE).some((problem) => /createPaper/.test(problem)))
})

test("every API path that inserts a Paper row starts its new-engine log", () => {
  const files = execFileSync("git", ["ls-files", "apps/api/src"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file.endsWith(".ts"))
  const problems = files.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.deepEqual(problems, [])
})
