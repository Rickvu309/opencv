import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  hiddenSkillPaths,
  hiddenSkills,
  skillIsIgnored,
} from "./lib/ignored-skills.mjs"
import { withTempDir } from "./lib/temp-dir.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const GIT_TIMEOUT_MS = 30_000

const MISTAKE =
  ".claude/*\n!.claude/skills/\n.claude/skills/*\n!.claude/skills/verify-opencv/\n"
const CLEAN = ".claude/*\n!.claude/skills/\n"
const LOCAL_ONLY_STATE =
  ".claude/*\n!.claude/skills/\n.claude/settings.local.json\n"

const gitignoreAt = (sha) => {
  try {
    return execFileSync("git", ["show", `${sha}:.gitignore`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: GIT_TIMEOUT_MS,
    })
  } catch {
    return null
  }
}

test("a new skill folder is not hidden by .gitignore", () => {
  assert.equal(skillIsIgnored(MISTAKE), true)
  assert.equal(skillIsIgnored(CLEAN), false)
  assert.equal(skillIsIgnored(LOCAL_ONLY_STATE), false)
})

test("the .gitignore that hid a new skill from V2 is caught", (t) => {
  const old = gitignoreAt("2c0c9582")
  if (old === null) return t.skip("commit 2c0c9582 is not in this clone")
  assert.equal(skillIsIgnored(old), true)
})

test("this repo's .gitignore lets a new skill through", () => {
  assert.equal(
    skillIsIgnored(readFileSync(path.join(root, ".gitignore"), "utf8")),
    false,
    "A new .claude/skills/<name>/SKILL.md would be ignored. Remove the .claude/skills/* line and the per-skill allowlist from .gitignore."
  )
})

const SKILL_GITIGNORE = [
  "*.log",
  "node_modules",
  ".env",
  ".claude/*",
  "!.claude/skills/",
  "",
].join("\n")

test("an ignored SKILL.md is hidden, a log or node_modules is not", () => {
  assert.deepEqual(
    hiddenSkillPaths([
      "!! .claude/skills/x/SKILL.md",
      "!! .claude/skills/y/SKILL.md",
      "!! .claude/skills/z/run.log",
      "!! .claude/skills/z/node_modules/",
      "!! .claude/skills/z/.env",
      "?? .claude/skills/w/",
    ]),
    [".claude/skills/x/SKILL.md", ".claude/skills/y/SKILL.md"]
  )
})

test("a skill folder holding an ignored log, node_modules and .env is not hidden", () => {
  withTempDir("skill-clean-", (dir) => {
    execFileSync("git", ["init", "--quiet"], {
      cwd: dir,
      timeout: GIT_TIMEOUT_MS,
    })
    writeFileSync(path.join(dir, ".gitignore"), SKILL_GITIGNORE)
    const skill = path.join(dir, ".claude", "skills", "x")
    mkdirSync(path.join(skill, "node_modules"), { recursive: true })
    writeFileSync(path.join(skill, "SKILL.md"), "---\nname: x\n---\n")
    writeFileSync(path.join(skill, "run.log"), "log\n")
    writeFileSync(path.join(skill, ".env"), "A=1\n")
    writeFileSync(path.join(skill, "node_modules", "a.js"), "\n")
    const status = execFileSync(
      "git",
      [
        "status",
        "--ignored",
        "--porcelain",
        "--untracked-files=all",
        ".claude/skills",
      ],
      { cwd: dir, encoding: "utf8", timeout: GIT_TIMEOUT_MS }
    )
    assert.match(status, /!! \.claude\/skills\/x\/run\.log/)
    assert.deepEqual(hiddenSkills(dir), [])
  })
})

test("a SKILL.md the ignore rules hide is caught in a real checkout", () => {
  withTempDir("skill-hidden-", (dir) => {
    execFileSync("git", ["init", "--quiet"], {
      cwd: dir,
      timeout: GIT_TIMEOUT_MS,
    })
    writeFileSync(path.join(dir, ".gitignore"), MISTAKE)
    const skill = path.join(dir, ".claude", "skills", "x")
    mkdirSync(skill, { recursive: true })
    writeFileSync(path.join(skill, "SKILL.md"), "---\nname: x\n---\n")
    assert.deepEqual(hiddenSkills(dir), [".claude/skills/x/SKILL.md"])
  })
})

test("no SKILL.md under .claude/skills is ignored in this checkout", () => {
  assert.deepEqual(hiddenSkills(root), [])
})
