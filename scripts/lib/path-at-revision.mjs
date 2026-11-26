import { execFileSync } from "node:child_process"

const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })

const exists = (rev, path) => {
  try {
    git(["cat-file", "-e", `${rev}:${path}`])
    return true
  } catch {
    return false
  }
}

export function pathAtRevision(rev, path) {
  if (exists(rev, path)) return path
  const names = git(["log", "--follow", "--name-only", "--format=", "--", path])
    .split("\n")
    .filter(Boolean)
  return [...new Set(names)].find((name) => exists(rev, name)) ?? path
}
