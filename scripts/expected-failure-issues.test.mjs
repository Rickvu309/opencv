import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  TEST_SOURCE,
  VITEST_TREES,
  detect,
} from "./lib/expected-failure-issues.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const SPAWN_TIMEOUT_MS = 30_000
const REPO = "Rickvu309/opencv"

const CLOSED_ISSUE_MISTAKE = [
  "it.fails(",
  '  "#758: a lost key race inside a transaction replays the winner",',
  "  async () => {}",
  ")",
].join("\n")

const UNNAMED_ISSUE_MISTAKE = [
  "const onServer = REAL ? it.fails : it.skip",
  "onServer(",
  "  `${KNOWN_FINDING.issue}: callers that pass the key lookup together all get the replay`,",
  "  async () => {}",
  ")",
].join("\n")

const CLEAN = [
  'it("replays the winner", async () => {})',
  "// a note that mentions it.fails is not a test",
  'test("#758 is fixed", () => {})',
].join("\n")

test("an expected failure must cite an open issue in its title", () => {
  assert.equal(detect(CLOSED_ISSUE_MISTAKE, "a.test.ts").length, 1)
  assert.equal(
    detect(CLOSED_ISSUE_MISTAKE, "a.test.ts", new Set([12]))[0].issue,
    758
  )
  assert.deepEqual(
    detect(CLOSED_ISSUE_MISTAKE, "a.test.ts", new Set([758])),
    []
  )
  const unnamed = detect(UNNAMED_ISSUE_MISTAKE, "b.test.ts", new Set([758]))
  assert.equal(unnamed.length, 1)
  assert.equal(unnamed[0].issue, null)
  assert.match(unnamed[0].message, /b\.test\.ts:1: .*names no issue/)
  const definitions = `${UNNAMED_ISSUE_MISTAKE}\nexport const KNOWN_FINDING = {\n  issue: "#758",\n  pgCode: "25P02",\n}`
  const resolved = detect(
    UNNAMED_ISSUE_MISTAKE,
    "b.test.ts",
    new Set(),
    definitions
  )
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].issue, 758)
  assert.match(resolved[0].message, /cites #758, which is not open/)
  assert.deepEqual(
    detect(UNNAMED_ISSUE_MISTAKE, "b.test.ts", new Set([758]), definitions),
    []
  )
  assert.deepEqual(detect(CLEAN, "c.test.ts"), [])
  assert.ok(TEST_SOURCE.test("apps/api/src/test/registry-formal-support.ts"))
  assert.ok(TEST_SOURCE.test("apps/web/src/a.test.tsx"))
  assert.ok(!TEST_SOURCE.test("apps/api/src/registry/registry.ts"))
})

function openAmong(issues) {
  const open = new Set()
  for (const issue of issues) {
    try {
      const out = execFileSync(
        "gh",
        ["issue", "view", String(issue), "--repo", REPO, "--json", "state"],
        { encoding: "utf8", timeout: SPAWN_TIMEOUT_MS, stdio: "pipe" }
      )
      if (JSON.parse(out).state === "OPEN") open.add(issue)
    } catch (error) {
      if (/not found|Could not resolve/i.test(String(error.stderr))) continue
      return null
    }
  }
  return open
}

test("every expected failure in the repo cites an issue that is still open", (t) => {
  const files = execFileSync("git", ["ls-files", "--", ...VITEST_TREES], {
    cwd: root,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
  })
    .split("\n")
    .filter((file) => TEST_SOURCE.test(file))
  const texts = files.map((file) => ({
    file,
    text: readFileSync(path.join(root, file), "utf8"),
  }))
  const definitions = texts.map(({ text }) => text).join("\n")
  const cited = texts.flatMap(({ file, text }) =>
    detect(text, file, new Set(), definitions)
  )
  assert.deepEqual(
    cited.filter((hit) => hit.issue === null).map((hit) => hit.message),
    []
  )
  if (!cited.length) return
  const open = openAmong(
    new Set(cited.map((hit) => hit.issue).filter((issue) => issue !== null))
  )
  if (!open) {
    t.skip(
      `gh cannot list open issues here, so ${cited.length} cited expected failure(s) go unchecked; the push hook checks them`
    )
    return
  }
  assert.deepEqual(
    texts.flatMap(({ file, text }) =>
      detect(text, file, open, definitions).map((hit) => hit.message)
    ),
    []
  )
})
