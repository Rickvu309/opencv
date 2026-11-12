import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { UsageError, parseArgs } from "./args.mjs"
import { runUi } from "./cli.mjs"
import { fakePorts } from "./fake-ports.mjs"

const pen = readFileSync(
  new URL("./fixtures/small.pen.json", import.meta.url),
  "utf8"
)

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
})

test("frame prints one geometry line from the pen file named by OCV_PEN", async () => {
  const ctx = fakePorts({
    files: { "/p.pen": pen },
    env: { OCV_PEN: "/p.pen" },
  })
  const { code, lines } = await runUi(["frame", "placed"], ctx)
  assert.equal(code, 0)
  assert.equal(lines.length, 1)
  assert.deepEqual(JSON.parse(lines[0]).x, 1020)
})

test("frame without a pen file prints the git command that fetches it", async () => {
  const { code, lines } = await runUi(["frame", "REfNk"], fakePorts())
  assert.equal(code, 2)
  assert.match(lines[0], /git fetch origin chore\/350-design-kit-cli-skills/)
})

test("shot, measure and check refuse without a running app and name the up command", async () => {
  const ctx = fakePorts({
    files: { "/p.pen": pen },
    env: { OCV_PEN: "/p.pen" },
  })
  for (const argv of [
    ["shot", "coach-home"],
    ["measure", "coach-home"],
    ["check", "paper-panel-open"],
  ]) {
    const { code, lines } = await runUi(argv, ctx)
    assert.equal(code, 2)
    assert.match(lines[0], /run node scripts\/ui\.mjs up/)
  }
})

test("unknown screens, unmapped screens and unknown commands are usage errors", async () => {
  assert.match(
    (await runUi(["shot", "nope"], fakePorts())).lines[0],
    /unknown screen nope/
  )
  assert.match(
    (await runUi(["check", "coach-home"], fakePorts())).lines[0],
    /add rows to scripts\/ui\/design-map\.mjs/
  )
  assert.equal((await runUi(["paint"], fakePorts())).code, 2)
  assert.equal((await runUi([], fakePorts())).code, 0)
})
