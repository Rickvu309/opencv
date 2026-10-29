import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
export const SLOW = "scripts/open-pr.test.mjs"

const gitList = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.test.mjs"],
    { cwd: root, encoding: "utf8" }
  )

// Every node:test file in the repo except the slow open-pr suite, which has its own script.
// An empty or failed listing throws: running no guards must never read as a pass.
export function discoverTests(list = gitList) {
  const files = list()
    .split("\n")
    .filter(Boolean)
    .filter((file) => file !== SLOW)
    .sort()
  if (files.length === 0)
    throw new Error("git ls-files found no *.test.mjs file")
  return files
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.includes("--open-pr") ? [SLOW] : discoverTests()
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: root,
    stdio: "inherit",
  })
  process.exit(result.status ?? 1)
}
