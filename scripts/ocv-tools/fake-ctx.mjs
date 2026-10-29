import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Test helper: a fake gh/git runner plus in-memory files. Each rule is [substring, result].
// The first rule whose substring is in "cmd args" wins; unmatched calls fail loudly.
export const NOW = Date.parse("2026-10-29T12:00:00Z")

const RESULTS = mkdtempSync(join(tmpdir(), "ocv-tools-results-"))

export function fakeCtx(rules, { files = {}, env = {} } = {}) {
  const calls = []
  const written = {}
  const ctx = {
    calls,
    written,
    env: {
      PR_RESULT_DIR: RESULTS,
      PR_RESULT_REPO: "opencv",
      PR_DISK_MIN_MB: "1",
      PR_TMP_MIN_MB: "1",
      ...env,
    },
    now: () => NOW,
    // Injected GitHub clock. Production reads the Date header; tests set this
    // and the rate_limit fake below turns it into that header.
    serverNow: () => NOW,
    nodeVersion: "v22.1.0",
    readFile: (path) => {
      if (path in written) return written[path]
      if (path in files) return files[path]
      throw new Error(`ENOENT ${path}`)
    },
    writeFile: (path, text) => {
      written[path] = text
    },
    writeScratch: (name, text) => {
      written[name] = text
      return `/tmp/${name}`
    },
    run(cmd, args) {
      const line = `${cmd} ${args.join(" ")}`
      calls.push(line)
      if (line.includes("api --include /rate_limit")) {
        const stamp = new Date(ctx.serverNow())
        const header = Number.isNaN(stamp.getTime())
          ? "not-a-date"
          : stamp.toUTCString()
        return { ok: true, out: `Date: ${header}\r\n\r\n{}`, err: "" }
      }
      for (const [match, result] of rules)
        if (line.includes(match))
          return typeof result === "function"
            ? result(line)
            : { ok: true, out: result, err: "" }
      return { ok: false, out: "", err: `unmocked: ${line}` }
    },
  }
  return ctx
}

export function issueData(over = {}) {
  const issue = {
    number: 90,
    title: "feat: Keep my search",
    state: "OPEN",
    body: "### Type\n\nfeat\n\n### Risk\n\nnormal\n",
    createdAt: "2026-10-01T00:00:00Z",
    lastEditedAt: null,
    labels: { nodes: [{ name: "risk:normal" }] },
    assignees: { nodes: [] },
    comments: { nodes: [] },
    ...over,
  }
  return JSON.stringify({
    data: { repository: { owner: { login: "owner" }, issue } },
  })
}

export const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString()

// A real clone with a bare origin (main has .githooks/, .env.example, package.json). Only gh is faked.
export function tempClone() {
  const root = mkdtempSync(join(tmpdir(), "ocv-tools-clone-"))
  const sh = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" })
  sh(root, "init", "-q", "--bare", "-b", "main", "origin.git")
  sh(root, "clone", "-q", "origin.git", "opencv")
  const work = join(root, "opencv")
  for (const [k, v] of [
    ["user.name", "t"],
    ["user.email", "t@example.com"],
    ["core.hooksPath", "/dev/null"],
  ])
    sh(work, "config", k, v)
  mkdirSync(join(work, ".githooks"))
  writeFileSync(join(work, ".githooks", "pre-push"), "#!/bin/sh\n")
  writeFileSync(join(work, ".env.example"), "A=1\nPORT=3001\n")
  writeFileSync(join(work, "package.json"), "{}\n")
  sh(work, "add", "-A")
  sh(work, "commit", "-q", "-m", "init")
  sh(work, "push", "-q", "origin", "main")
  return {
    root,
    work,
    sh,
    done: () => rmSync(root, { recursive: true, force: true }),
  }
}
