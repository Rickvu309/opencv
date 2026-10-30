// The layers hold by construction: only index.mjs imports a subject row
// file, every moment a row names has a runner, and a native row names a
// ruleset rule GitHub actually enforces.
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, sep } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { MOMENTS, RULES, RUNNERS, layerOf, needsOf } from "./index.mjs"

const here = fileURLToPath(new URL("..", import.meta.url))
const root = fileURLToPath(new URL("../../..", import.meta.url))

const SUBJECTS = [
  "pull",
  "diff",
  "commits",
  "workspace",
  "claim",
  "jobs",
  "table",
]

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (name.endsWith(".mjs") && !name.endsWith(".test.mjs"))
      out.push(path)
  }
  return out
}

// Jobs from before the moment split that have no moment of their own.
const LEGACY_JOBS = [
  "release",
  "cleanup",
  "status",
  "approve",
  "shot",
  "board",
  "file",
  "cli",
]

test("subject row files are imported only by rules/index.mjs", () => {
  const names = SUBJECTS.join("|")
  const sibling = new RegExp(`from\\s+["']\\./(${names})\\.mjs["']`)
  const nested = new RegExp(`from\\s+["'][^"']*rules/(${names})\\.mjs["']`)
  for (const path of sources(here)) {
    if (path.endsWith(join("rules", "index.mjs"))) continue
    const text = readFileSync(path, "utf8")
    const inRules = path.split(sep).includes("rules")
    const hit = (inRules ? sibling.exec(text) : null) ?? nested.exec(text)
    assert.ok(!hit, `${path} imports a subject row file (${hit?.[1]}.mjs)`)
  }
})

test("every checked row runs at known moments; the layer derives from them", () => {
  for (const row of RULES) {
    if (row.kind === "judgment" || !row.check) {
      assert.deepEqual([...row.at], [], row.id)
      continue
    }
    assert.ok(row.at?.length, `${row.id} has no moment`)
    for (const moment of row.at)
      assert.ok(
        MOMENTS.includes(moment) || LEGACY_JOBS.includes(moment),
        `${row.id}: unknown moment ${moment}`
      )
    assert.equal(
      layerOf(row),
      row.at.includes("pr") ? "server" : "local",
      row.id
    )
  }
  assert.ok(needsOf("pr").includes("pull"))
  assert.ok(needsOf("pr").includes("diff"))
})

test("every moment a row uses has a runner that fires rows", () => {
  const used = new Set(RULES.flatMap((row) => row.at))
  for (const moment of MOMENTS) {
    if (!used.has(moment)) continue
    const files = RUNNERS[moment]
    assert.ok(files?.length, `no runner for moment ${moment}`)
    const text = files
      .map((file) => {
        const path = join(root, file)
        assert.ok(existsSync(path), `runner for ${moment} is missing: ${file}`)
        return readFileSync(path, "utf8")
      })
      .join("\n")
    if (files.every((file) => file.endsWith(".mjs")))
      assert.match(
        text,
        /decide\(|evaluate\(|refuse\(/,
        `no runner fires rows at ${moment}`
      )
  }
})

test("a native row names a ruleset rule GitHub enforces on main", () => {
  const ruleset = JSON.parse(
    readFileSync(join(root, ".github/rulesets/main.json"), "utf8")
  )
  const types = new Set(ruleset.rules.map((rule) => rule.type))
  for (const row of RULES.filter((row) => row.ruleset))
    assert.ok(types.has(row.ruleset), `${row.id}: no ruleset ${row.ruleset}`)
})
