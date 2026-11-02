import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { detect } from "./lib/skill-refs.mjs"
import { RULE_GUIDES, rulesDocMatches } from "./ocv-tools/rules/doc.mjs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const skills = path.join(root, ".claude/skills")

const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
)
  .split("\n")
  .filter(Boolean)

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules") yield* walk(full)
    } else yield full
  }
}

const verifySkills = readdirSync(skills).filter((name) =>
  name.startsWith("verify-")
)

const REPO_PREFIX =
  /^(?:apps|packages|scripts|docs|\.claude|\.githooks|\.github)\//
const PLACEHOLDER = /[<>*{$]|\.\.\./
const CODE_EXT = /\.(?:tsx?|mjs|css|md|sh)$/
const GENERATED = /^apps\/api\/\.data\/|\/dist(?:\/|$)/
const ROOT_DOCS = ["AGENTS.md", "CODING_STANDARDS.md", "CONTEXT.md"]

const docs = tracked.filter(
  (file) =>
    ROOT_DOCS.includes(file) ||
    (file.endsWith(".md") && /^(?:docs|\.claude\/skills)\//.test(file))
)

function* codeWords(markdown) {
  let fenced = false
  const lines = markdown.split("\n")
  for (const [index, text] of lines.entries()) {
    const line = index + 1
    if (/^\s*```/.test(text)) {
      fenced = !fenced
      continue
    }
    const spans = fenced
      ? [text]
      : [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])
    for (const span of spans)
      for (const word of span.split(/\s+/))
        yield { word, inline: !fenced, line }
  }
}

const clean = (word) =>
  word
    .replace(/#.*$/, "")
    .replace(/:\d+(?:-\d+)?$/, "")
    .replace(/[),.;:]+$/, "")
    .replace(/^\(+/, "")

function missingPath(word, file) {
  if (!word || PLACEHOLDER.test(word) || GENERATED.test(word)) return false
  if (REPO_PREFIX.test(word)) {
    const skill = /^\.claude\/skills\/[^/]+/.exec(file)?.[0]
    return !(
      existsSync(path.join(root, word)) ||
      (skill && existsSync(path.join(root, skill, word)))
    )
  }
  if (/^[~/@-]/.test(word)) return false
  if (!CODE_EXT.test(word)) return false
  return !tracked.some((name) => name === word || name.endsWith(`/${word}`))
}

test("every repo path a doc cites in backticks exists", () => {
  const missing = []
  let checked = 0
  assert.ok(
    ["verify-app-ui", "verify-landing"].every((n) => verifySkills.includes(n)),
    `verify-app-ui and verify-landing are not both under ${skills}; the test would check nothing`
  )
  assert.ok(docs.includes("AGENTS.md"), "the doc list lost AGENTS.md")
  for (const file of docs) {
    for (const { word, inline, line } of codeWords(
      readFileSync(path.join(root, file), "utf8")
    )) {
      const candidate = clean(word)
      if (!inline && !REPO_PREFIX.test(candidate)) continue
      checked += 1
      if (missingPath(candidate, file))
        missing.push(`${file}:${line} cites ${candidate}`)
    }
  }
  assert.ok(checked > 0, "the doc scan found no path to check")
  assert.deepEqual(
    missing,
    [],
    `A doc cites a file that is gone. Name the file that holds the code now, or delete the mention.\n${missing.join("\n")}`
  )
})

const sourceIds = (skill, test) => {
  const found = new Map()
  const dir = path.join(skills, skill, "scripts")
  for (const file of walk(dir)) {
    if (!file.endsWith(".mjs") || /\.test\.mjs$/.test(file)) continue
    const text = readFileSync(file, "utf8")
    for (const [, id, name] of text.matchAll(test)) found.set(id, name)
  }
  return found
}

const docIds = (file) =>
  new Map(
    [...readFileSync(file, "utf8").matchAll(/^- (\d+[a-z]?) `([^`]+)`/gm)].map(
      (m) => [m[1], m[2]]
    )
  )

function compare(documented, emitted, where) {
  const problems = []
  for (const [id, name] of documented) {
    if (!emitted.has(id))
      problems.push(`${where} lists ${id} ${name}, no check emits it`)
    else if (emitted.get(id) !== name)
      problems.push(
        `${where} names ${id} ${name}, the check says ${emitted.get(id)}`
      )
  }
  for (const [id, name] of emitted)
    if (!documented.has(id))
      problems.push(`${where} has no row for ${id} ${name}`)
  return problems
}

test("verify-app-ui properties.md and the checker list the same ids", () => {
  const emitted = sourceIds(
    "verify-app-ui",
    /(?:result|stale|judged)\(\s*"(\d+[a-z]?)",\s*"([^"]+)"/g
  )
  assert.ok(emitted.size > 0, "found no check ids in the checker")
  const problems = compare(
    docIds(path.join(skills, "verify-app-ui/properties.md")),
    emitted,
    "properties.md"
  )
  assert.deepEqual(problems, [], problems.join("\n"))
})

test("verify-landing SKILL.md and the checker list the same ids", () => {
  const emitted = sourceIds(
    "verify-landing",
    /(?:verdict|stale|judged)\(\s*"(\d+[a-z]?)",\s*"([^"]+)"/g
  )
  assert.ok(emitted.size > 0, "found no check ids in the checker")
  const problems = compare(
    docIds(path.join(skills, "verify-landing/SKILL.md")),
    emitted,
    "SKILL.md"
  )
  assert.deepEqual(problems, [], problems.join("\n"))
})

test("rule-enforcement.md matches the ocv-tools rule table", () => {
  for (const { path, table } of RULE_GUIDES)
    assert.equal(rulesDocMatches(readFileSync(path, "utf8"), table), true)
})

const skillDocs = tracked.filter((file) =>
  /^\.claude\/skills\/(?:[^/]+\/)*SKILL\.md$/.test(file)
)

const fakeRepo = {
  exists: (rel) =>
    [
      "scripts/tlc.mjs",
      ".claude/skills/verify-app-ui/scripts/launch.sh",
      ".claude/skills/verify-opencv/scripts/cleanup.sh",
    ].includes(rel),
  packageDir: (name) => (name === "web" ? "apps/web" : null),
  scripts: (dir) =>
    new Map([
      ["", new Set(["check"])],
      ["apps/web", new Set(["verify:app-ui"])],
    ]).get(dir) ?? new Set(),
}

const SKILL = ".claude/skills/verify-app-ui/SKILL.md"

test("a skill that names a missing script, a bare script with no folder, or a missing pnpm script fails", () => {
  const mistake = [
    "Run `scripts/gone.mjs` first.",
    "Then `pnpm --filter web verify:gone`.",
    "Clean up with cleanup.sh.",
    "Run `pnpm nope`.",
  ].join("\n")
  assert.equal(detect(mistake, SKILL, fakeRepo).length, 4)
})

test("a skill that names real scripts, full paths and real pnpm scripts passes", () => {
  const clean = [
    "Run `pnpm check`, `pnpm install` and `pnpm --filter web verify:app-ui`.",
    "Call `.claude/skills/verify-opencv/scripts/cleanup.sh`, `scripts/tlc.mjs` and `scripts/launch.sh`.",
  ].join("\n")
  assert.deepEqual(detect(clean, SKILL, fakeRepo), [])
})

test("every script a skill names and every pnpm script it runs exists", () => {
  const problems = skillDocs.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file)
  )
  assert.ok(skillDocs.length > 0, "the skill scan found no SKILL.md")
  assert.deepEqual(problems, [], problems.join("\n"))
})
