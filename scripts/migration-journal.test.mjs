import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  detect,
  fileProblems,
  journalProblems,
} from "./lib/migration-journal.mjs"

const drizzle = fileURLToPath(new URL("../apps/api/drizzle/", import.meta.url))

const MAIN_0022 = { idx: 22, when: 1794493169210, tag: "0022_job_word_pages" }
const PR_1406 = {
  idx: 23,
  when: 1794502581685,
  tag: "0023_auth_limit_counters",
}
const PR_1407 = [
  { idx: 23, when: 1794503203296, tag: "0023_package_trash" },
  { idx: 24, when: 1794505072444, tag: "0024_word_rename_retained" },
]
const SNAP_0022 = "7d7f5501-a961-4c43-ae0e-073adb74215f"
const SNAP_1406 = "ae6407a6-2c1a-41dd-8889-8fab4bbfe146"
const SNAP_1407 = [
  "fd475be4-fd02-414d-820d-de68f98ae5b9",
  "d649f85f-8ea6-4978-a00c-3c31d29f34ce",
]
const renumbered = (entry, by) => ({
  ...entry,
  idx: entry.idx + by,
  tag: `${String(entry.idx + by).padStart(4, "0")}${entry.tag.slice(4)}`,
})

test("the mistake fixture fires: PR #1407's journal merged after PR #1406 without renumbering", () => {
  const problems = journalProblems([MAIN_0022, PR_1406, ...PR_1407])
  assert.ok(
    problems.some((p) =>
      /^idx 23 is used by 0023_auth_limit_counters and 0023_package_trash/.test(
        p
      )
    ),
    problems.join("\n")
  )
  assert.ok(problems.some((p) => /^number 0023 is used by/.test(p)))
})

test("the mistake fixture fires: PR #1407 merged first and PR #1406 renumbered to 0025 keeps its older when, which production would skip", () => {
  const problems = journalProblems([
    MAIN_0022,
    ...PR_1407,
    renumbered(PR_1406, 2),
  ])
  assert.deepEqual(problems, [
    "0025_auth_limit_counters has when 1794502581685, not later than 0024_word_rename_retained (1794505072444); production skips a migration older than the last one it ran, with no error. Give it a when after 1794505072444",
  ])
})

test("the mistake fixture fires: a renumbered snapshot still links to 0022, and a migration file with no journal entry", () => {
  const problems = fileProblems(
    [MAIN_0022, PR_1406, renumbered(PR_1407[0], 1)],
    [
      "0022_job_word_pages.sql",
      "0023_auth_limit_counters.sql",
      "0024_package_trash.sql",
      "0025_word_rename_retained.sql",
    ],
    {
      "0022_snapshot.json": { id: SNAP_0022, prevId: "x" },
      "0023_snapshot.json": { id: SNAP_1406, prevId: SNAP_0022 },
      "0024_snapshot.json": { id: SNAP_1407[0], prevId: SNAP_0022 },
    }
  )
  assert.deepEqual(problems, [
    "0025_word_rename_retained.sql has no journal entry, so it never runs",
    `snapshot 0024 links to ${SNAP_0022}, not to snapshot 0023 (${SNAP_1406}); regenerate it after the last migration on main`,
  ])
})

test("the clean fixture stays quiet: PR #1406 first, then PR #1407 renumbered to 0024 and 0025 with its later when values", () => {
  const entries = [MAIN_0022, PR_1406, ...PR_1407.map((e) => renumbered(e, 1))]
  assert.deepEqual(journalProblems(entries), [])
  assert.deepEqual(
    fileProblems(
      entries,
      entries.map((e) => `${e.tag}.sql`),
      {
        "0022_snapshot.json": { id: SNAP_0022, prevId: "x" },
        "0023_snapshot.json": { id: SNAP_1406, prevId: SNAP_0022 },
        "0024_snapshot.json": { id: SNAP_1407[0], prevId: SNAP_1406 },
        "0025_snapshot.json": { id: SNAP_1407[1], prevId: SNAP_1407[0] },
      }
    ),
    []
  )
})

test("this tree's migration journal, files and snapshot chain are in order", () => {
  const journal = readFileSync(join(drizzle, "meta/_journal.json"), "utf8")
  const entries = JSON.parse(journal).entries
  const snapshots = Object.fromEntries(
    readdirSync(join(drizzle, "meta"))
      .filter((name) => name.endsWith("_snapshot.json"))
      .map((name) => {
        const { id, prevId } = JSON.parse(
          readFileSync(join(drizzle, "meta", name), "utf8")
        )
        return [name, { id, prevId }]
      })
  )
  const problems = [
    ...detect(journal),
    ...fileProblems(
      entries,
      readdirSync(drizzle).filter((name) => name.endsWith(".sql")),
      snapshots
    ),
  ]
  assert.deepEqual(problems, [], problems.join("\n"))
})
