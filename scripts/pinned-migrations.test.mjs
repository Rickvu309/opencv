import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { pinnedMigrationTags } from "./lib/pinned-migrations.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const API_SRC = path.join(root, "apps/api/src")
const TEST_FILE = /\.(?:test|type-test)\.tsx?$|[\\/]test[\\/]/
const GIT_TIMEOUT_MS = 30_000
const PINNED_HEALTH_TEST_SHA = "4d674be9"

const tag = (number, name) => `${number}_${name}`

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? sourceFiles(full) : [full]
  })
}

const MISTAKE = `expect(body).toEqual({ schemaVersion: "${tag("0005", "paper_edit_based_on")}" })`
const CLEAN = `expect(body).toEqual({ schemaVersion: newestMigrationTag() })`

test("a test that pins a migration tag is flagged", () => {
  assert.deepEqual(pinnedMigrationTags(MISTAKE), [
    tag("0005", "paper_edit_based_on"),
  ])
  assert.deepEqual(pinnedMigrationTags(CLEAN), [])
})

test("a tag inside a file name is flagged, a long number is not", () => {
  assert.deepEqual(
    pinnedMigrationTags(`readFile("${tag("0002", "chat_reply")}.sql")`),
    [tag("0002", "chat_reply")]
  )
  assert.deepEqual(pinnedMigrationTags("const at = 1793370000001"), [])
})

test("the health test that pinned the schema version is caught", (t) => {
  let past
  try {
    past = execFileSync(
      "git",
      ["show", `${PINNED_HEALTH_TEST_SHA}:apps/api/src/health.test.ts`],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: GIT_TIMEOUT_MS,
      }
    )
  } catch {
    return t.skip(`commit ${PINNED_HEALTH_TEST_SHA} is not in this clone`)
  }
  assert.notEqual(pinnedMigrationTags(past).length, 0)
})

test("no api test pins a migration tag", () => {
  const offenders = sourceFiles(API_SRC)
    .filter((file) => TEST_FILE.test(file))
    .map((file) => [
      path.relative(root, file),
      pinnedMigrationTags(readFileSync(file, "utf8")),
    ])
    .filter(([, tags]) => tags.length > 0)
    .map(([file, tags]) => `${file}: ${tags.join(", ")}`)
  assert.deepEqual(offenders, [])
})
