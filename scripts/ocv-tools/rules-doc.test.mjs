import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"
import { RULES } from "./rules/index.mjs"
import {
  RULES_DOC,
  RULE_GUIDES,
  renderRulesDoc,
  rulesDocMatches,
} from "./rules/doc.mjs"

test("the rules guide is generated from the table", () => {
  const md = renderRulesDoc()
  assert.match(
    md,
    /\| rule +\| what makes it fail +\| fix +\| at +\| holds against main \|/
  )
  for (const row of RULES) assert.ok(md.includes(row.id), row.id)
  assert.match(md, /OTHER_WORKTREE \(2\).*Nothing/)
  assert.match(md, /\| ON_MAIN \(2\).*\| commit +\| no +\|/)
  assert.match(md, /\| PR_METADATA \(4\).*\| finish, pr +\| yes +\|/)
  for (const { path, table } of RULE_GUIDES)
    assert.equal(rulesDocMatches(readFileSync(path, "utf8"), table), true)
})

test("rules --check fails on a stale block and --write repairs the fake", () => {
  const ports = fakePorts()
  const ctx = ctxFor(ports)
  const fresh = readFileSync(RULES_DOC, "utf8")
  assert.equal(runCli(["rules", "--check"], ctx).code, 0)
  ports.fs.write(
    RULES_DOC,
    fresh.replaceAll("NOT_AN_ISSUE", "NOT_AN_ISSUE_STALE")
  )
  const stale = runCli(["rules", "--check"], ctx)
  assert.equal(stale.code, 1)
  assert.match(stale.text, /Fix: Run: scripts\/ocv-tools\.mjs rules --write/)
  assert.equal(runCli(["rules", "--write"], ctx).code, 0)
  assert.equal(runCli(["rules", "--check"], ctx).code, 0)
  const delivery = RULE_GUIDES[1].path
  ports.fs.write(
    delivery,
    ports.fs.read(delivery).replaceAll("STALE_CHECK", "STALE")
  )
  assert.equal(runCli(["rules", "--check"], ctx).code, 1)
  assert.equal(runCli(["rules", "--write"], ctx).code, 0)
  assert.equal(runCli(["rules", "--check"], ctx).code, 0)
  const listed = runCli(["rules", "--list"], ctx)
  assert.equal(listed.code, 0)
  assert.match(listed.text, /NOT_AN_ISSUE:/)
  assert.match(listed.text, /\nNext: /)
})

test("doctor lists every rule from the table", () => {
  const { text } = runCli(["doctor"], ctxFor(fakePorts()))
  assert.match(text, /Rules:/)
  for (const row of RULES) assert.match(text, new RegExp(`  ${row.id}:`))
})

test("rules --write leaves each guide exactly as prettier prints it", async () => {
  const prettier = await import("prettier")
  const ports = fakePorts()
  const ctx = ctxFor(ports)
  assert.equal(runCli(["rules", "--write"], ctx).code, 0)
  for (const { path } of RULE_GUIDES) {
    const written = ports.fs.read(path)
    const config = await prettier.resolveConfig(path)
    assert.equal(
      await prettier.format(written, { ...config, filepath: path }),
      written,
      `${path} needs prettier after rules --write`
    )
  }
})

test("a table with a wide row is padded to the widest cell in every column", () => {
  const table = renderRulesDoc(RULES.slice(0, 3)).split("\n")
  assert.equal(new Set(table.map((line) => line.length)).size, 1)
})
