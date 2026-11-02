import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { withTempDir } from "./temp-dir.mjs"

export const SAMPLE_SKILL = ".claude/skills/a-new-skill/SKILL.md"
const GIT_TIMEOUT_MS = 30_000

export function skillIsIgnored(gitignoreText) {
  return withTempDir("skill-ignore-", (dir) => {
    execFileSync("git", ["init", "--quiet"], {
      cwd: dir,
      timeout: GIT_TIMEOUT_MS,
    })
    writeFileSync(join(dir, ".gitignore"), gitignoreText)
    try {
      execFileSync("git", ["check-ignore", "--quiet", SAMPLE_SKILL], {
        cwd: dir,
        timeout: GIT_TIMEOUT_MS,
      })
      return true
    } catch (error) {
      if (error.status === 1) return false
      throw error
    }
  })
}

export function hiddenSkillPaths(statusLines) {
  return statusLines
    .filter((line) => line.startsWith("!! "))
    .map((line) => line.slice(3).replace(/\/$/, ""))
    .filter((file) => file.endsWith("/SKILL.md"))
}

export function hiddenSkills(cwd) {
  const status = execFileSync(
    "git",
    [
      "status",
      "--ignored",
      "--porcelain",
      "--untracked-files=all",
      ".claude/skills",
    ],
    { cwd, encoding: "utf8", timeout: GIT_TIMEOUT_MS }
  )
  return hiddenSkillPaths(status.split("\n"))
}
