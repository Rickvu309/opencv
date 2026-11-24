import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"
import { RULES } from "./rules/index.mjs"

test("rules lists the current rules without reading or writing guides", () => {
  for (const args of [["rules"], ["rules", "--list"]]) {
    const ports = fakePorts()
    ports.fs.read = () => assert.fail("rules must not read a guide")
    ports.fs.write = () => assert.fail("rules must not write a guide")
    const { code, text } = runCli(args, ctxFor(ports))
    assert.equal(code, 0)
    for (const row of RULES) assert.ok(text.includes(`${row.id}: ${row.says}`))
    assert.match(text, /Next: scripts\/ocv-tools\.mjs help/)
  }
})

test("retired guide flags fail with current replacement commands", () => {
  for (const flags of [["--check"], ["--write"], ["--check", "--write"]]) {
    const ports = fakePorts()
    ports.fs.read = () => assert.fail("retired flags must not read a guide")
    ports.fs.write = () =>
      assert.fail("retired flags must not recreate a guide")
    const { code, text } = runCli(["rules", ...flags], ctxFor(ports))
    assert.equal(code, 1)
    assert.match(
      text,
      /are retired because the generated workflow guides were removed/
    )
    assert.match(text, /rules --list/)
    assert.doesNotMatch(text, /ENOENT|Rules doc matches/)
  }
})

test("help advertises current rule listing and explains retired guide flags", () => {
  const { code, text } = runCli(["help"], ctxFor(fakePorts()))
  assert.equal(code, 0)
  assert.match(text, /rules \[--list\]/)
  assert.match(text, /retired --check and --write flags fail/)
  assert.doesNotMatch(text, /rules \[--write\|--check/)
})
