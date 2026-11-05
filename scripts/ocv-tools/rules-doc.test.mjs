import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"
import { MOMENTS, RULES, RUNNERS } from "./rules/index.mjs"
import { RULE_GUIDES, renderMomentsDoc, renderRulesDoc } from "./rules/doc.mjs"

test("doctor lists every rule from the table", () => {
  const { text } = runCli(["doctor"], ctxFor(fakePorts()))
  assert.match(text, /Rules:/)
  for (const row of RULES) assert.match(text, new RegExp(`  ${row.id}:`))
})

test("a table with a wide row is padded to the widest cell in every column", () => {
  const table = renderRulesDoc(RULES.slice(0, 3)).split("\n")
  assert.equal(new Set(table.map((line) => line.length)).size, 1)
})

test("the moments guide says what every moment means and which file runs it", () => {
  const md = renderMomentsDoc()
  for (const [moment, means] of Object.entries(MOMENTS)) {
    assert.ok(means.length > 20, `${moment} has no meaning`)
    assert.ok(md.includes(means), `${moment} is not explained`)
    for (const runner of RUNNERS[moment]) assert.ok(md.includes(runner))
  }
  assert.ok(RULE_GUIDES.some(({ render }) => render === renderMomentsDoc))
})

test("every why a row carries is printed in its guide", () => {
  const withWhy = RULES.filter((row) => row.why)
  assert.ok(withWhy.length > 0)
  for (const row of withWhy) {
    const guide = RULE_GUIDES.find(
      ({ table, render }) => !render && table.includes(row)
    )
    assert.ok(renderRulesDoc(guide.table).includes(row.why), row.id)
  }
})
