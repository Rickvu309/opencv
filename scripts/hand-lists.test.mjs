import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { REGISTRY_FIX, detectHandLists } from "./lib/hand-lists.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const BEFORE_DERIVED_LISTS = "6200873e"

const MISTAKES = {
  "a frozen array of guard paths": [
    "export const FAST_GUARDS = Object.freeze([",
    '  "scripts/a.test.mjs",',
    '  "scripts/b.test.mjs",',
    '  "scripts/c.test.mjs",',
    "])",
  ].join("\n"),
  "ledger rows written in a source file": [
    "const LEDGER = [",
    "  {",
    '    id: "one",',
    '    file: "scripts/one.test.mjs",',
    "  },",
    "  {",
    '    id: "two",',
    '    file: "scripts/two.test.mjs",',
    "  },",
    "]",
  ].join("\n"),
}

const CLEAN = {
  "the short CI_ONLY_GUARDS list": [
    "export const CI_ONLY_GUARDS = Object.freeze([",
    '  "scripts/a.test.mjs",',
    '  "scripts/b.test.mjs",',
    '  "scripts/c.test.mjs",',
    "])",
  ].join("\n"),
  "two guard paths": '  "scripts/a.test.mjs",\n  "scripts/b.test.mjs",\n',
  "one ledger row": '  id: "one",\n  file: "scripts/one.test.mjs",\n',
  "guard paths split by other lines":
    '  "scripts/a.test.mjs",\n  "scripts/b.test.mjs",\n  other,\n  "scripts/c.test.mjs",\n',
}

const show = (rev, file) =>
  execFileSync("git", ["show", `${rev}:${file}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })

const trackedSources = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "scripts"],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
    .split("\n")
    .filter(
      (file) =>
        file.endsWith(".mjs") &&
        !file.endsWith(".test.mjs") &&
        existsSync(path.join(root, file))
    )

test("a hand-kept registry list in a script is refused", () => {
  for (const [name, text] of Object.entries(MISTAKES))
    assert.ok(detectHandLists(text).length > 0, name)
  for (const [name, text] of Object.entries(CLEAN))
    assert.deepEqual(detectHandLists(text), [], name)
})

test("the lists that were hand-kept before this change are caught in history", () => {
  assert.ok(
    detectHandLists(
      show(BEFORE_DERIVED_LISTS, "scripts/ocv-tools/jobs/push-checks.mjs")
    ).length > 0
  )
  assert.ok(
    detectHandLists(show(BEFORE_DERIVED_LISTS, "scripts/guard-ledger.mjs"))
      .length > 0
  )
})

test("no script keeps a list that a directory or a glob already supplies", () => {
  const problems = trackedSources().flatMap((file) =>
    detectHandLists(readFileSync(path.join(root, file), "utf8")).map(
      (hit) => `${file}:${hit.line} ${hit.kind} (${hit.count}). ${REGISTRY_FIX}`
    )
  )
  assert.deepEqual(problems, [])
})

test(".gitattributes sets no union merge, which hides a deleted line and flips a negation", () => {
  const attributes = readFileSync(path.join(root, ".gitattributes"), "utf8")
  const unionLines = attributes
    .split("\n")
    .filter((line) => /(^|\s)merge=union(\s|$)/.test(line))
  assert.deepEqual(unionLines, [])
})
