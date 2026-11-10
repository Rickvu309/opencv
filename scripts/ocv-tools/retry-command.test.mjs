import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts } from "./ports/fake.mjs"

function run(over = {}) {
  const ports = fakePorts(over)
  return { ports, ctx: ctxFor(ports) }
}

test("the command to copy parses as shell and keeps the switches", () => {
  const { text } = runCli(
    [
      "take",
      "Keep it's search",
      "--type",
      "feature",
      "--done",
      "- Line one.\n- Line two.",
      "--no-install",
      "--dry-run",
    ],
    run({ issues: [] }).ctx
  )
  assert.match(
    text,
    /MISSING_FIELDS: --type must be feat, fix, hotfix, refactor, chore, docs, not "feature"; missing --what, --risk/
  )
  assert.doesNotMatch(text, /the title must start/)
  const retry = text.match(
    /run: (scripts\/ocv-tools\.mjs take [\s\S]*)\nRESULT_JSON|run: (scripts\/ocv-tools\.mjs take [\s\S]*)$/
  )
  const line = retry[1] ?? retry[2]
  assert.match(line, / --no-install --dry-run$/)
  assert.match(line, /--type '<feat\|fix/)
  execFileSync("bash", ["-n", "-c", line], { timeout: 5000 })
  const words = execFileSync(
    "bash",
    ["-c", `printf '%s\\0' ${line.replace(/^scripts\/ocv-tools\.mjs /, "")}`],
    { encoding: "utf8", timeout: 5000 }
  ).split("\0")
  assert.equal(words[1], "Keep it's search")
  assert.ok(words.includes("- Line one.\n- Line two."))
})

test("a help word that is a flag's value does not print help", () => {
  const { text } = runCli(["take", "90", "-d", "-h"], run().ctx)
  assert.doesNotMatch(text, /^Usage:/)
  assert.match(text, /MISSING_FIELDS: -d needs a value/)
  const shown = runCli(["finish", "--body-file", "b.md", "--help"], run().ctx)
  assert.match(shown.text, /^Usage: scripts\/ocv-tools\.mjs finish/)
})

test("a wrong type is ignored when the title already carries a legal one", () => {
  const { ports, ctx } = run({ issues: [], nextIssue: 83 })
  const { code, text } = runCli(
    [
      "file",
      "--title",
      "feat: Keep my search",
      "--type",
      "feature",
      "--what",
      "The page forgets your search. This keeps it.",
      "--done",
      "- I come back and the box still has my words.",
      "--risk",
      "low",
    ],
    ctx
  )
  assert.equal(code, 0, text)
  assert.match(text, /FILED #83: feat: Keep my search/)
  assert.ok(ports.effects.some((e) => e.op === "createIssue"))
})
