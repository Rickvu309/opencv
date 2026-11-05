import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { wallClockUses } from "./wall-clock.mjs"

const root = new URL("../../", import.meta.url)
const tracked = execFileSync("git", ["ls-files", "--cached", "*.test.mjs"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file && existsSync(new URL(file, root)))

test("no node test reads or waits on the wall clock", () => {
  const offenders = tracked.flatMap((file) =>
    wallClockUses(readFileSync(new URL(file, root), "utf8")).map(
      ({ line, use }) => `${file}:${line} ${use}`
    )
  )
  assert.deepEqual(offenders, [])
})

test("each wall-clock wait is caught", () => {
  for (const use of [
    ["set", "Timeout(() => {}, 5)"],
    ["set", "Interval(() => {}, 5)"],
    ["Date", ".now()"],
    ["performance", ".now()"],
    ['from "node:timers', '/promises"'],
    ["run({ time", "outMs: 2000 })"],
  ]) {
    assert.equal(wallClockUses(use.join("")).length, 1, use.join(""))
  }
})

test("a deadline passed with injected timers is allowed", () => {
  assert.deepEqual(wallClockUses("run({ timeoutMs: 500, timers })"), [])
})
