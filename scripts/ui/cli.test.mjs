import assert from "node:assert/strict"
import test from "node:test"
import { UsageError, parseArgs } from "./args.mjs"
import { runUi } from "./cli.mjs"
import { fakePorts } from "./fake-ports.mjs"

test("options take values inline or next, repeat by comma or flag, and unknown ones are refused", () => {
  const spec = { valued: ["out"], repeated: ["width"], switches: ["dry"] }
  assert.deepEqual(
    parseArgs(
      ["a", "--width", "1440,390", "--width=1280", "--out", "d", "--dry", "b"],
      spec
    ),
    {
      positional: ["a", "b"],
      flags: { width: ["1440", "390", "1280"], out: "d", dry: true },
    }
  )
  assert.throws(() => parseArgs(["--nope"], spec), UsageError)
  assert.throws(() => parseArgs(["--out"], spec), /--out needs a value/)
})

test("screens lists every screen with its steps or why it cannot be reached", async () => {
  const { code, lines } = await runUi(["screens"], fakePorts())
  assert.equal(code, 0)
  const screens = lines.map((line) => JSON.parse(line))
  assert.ok(
    screens.some(
      (screen) => screen.id === "paper-panel-open" && screen.steps > 0
    )
  )
  assert.ok(
    screens.some(
      (screen) => screen.id === "paper-proposal-card" && screen.steps > 0
    )
  )
  assert.ok(
    screens.some(
      (screen) => screen.id === "coach-chat-streaming" && screen.unreachable
    )
  )
  assert.ok(screens.every((screen) => !("designRows" in screen)))
})

test("shot and measure refuse without a running app and name the up command", async () => {
  const ctx = fakePorts()
  for (const argv of [
    ["shot", "coach-home"],
    ["measure", "coach-home"],
  ]) {
    const { code, lines } = await runUi(argv, ctx)
    assert.equal(code, 2)
    assert.match(lines[0], /run node scripts\/ui\.mjs up/)
  }
})

test("unknown screens, removed design commands and unknown commands are usage errors", async () => {
  assert.match(
    (await runUi(["shot", "nope"], fakePorts())).lines[0],
    /unknown screen nope/
  )
  for (const removed of [
    "check",
    "compare",
    "changes",
    "annotate",
    "pr-section",
    "frame",
    "diff",
  ])
    assert.equal((await runUi([removed], fakePorts())).code, 2)
  assert.equal((await runUi(["paint"], fakePorts())).code, 2)
  assert.equal((await runUi([], fakePorts())).code, 0)
})
