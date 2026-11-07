import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { withTempDir } from "../lib/temp-dir.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const BINDING = "apps/api/src/connections/http.ts"
const BEHAVIOR = "apps/api/src/connections/revoke-every-tool.test.ts"
const LIVE_CHECK = "await requireLiveDelegate(actor)"
const SKIPPED_CHECK = "if (false) await requireLiveDelegate(actor)"
const CRASH =
  /ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError|ERR_UNRESOLVED_PACKAGE/
const ASSERTED = /AssertionError|ERR_ASSERTION|^not ok|\bFAIL\b/m

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8" })
}

function moduleDirs() {
  const dirs = [""]
  for (const group of ["apps", "packages"]) {
    const base = path.join(root, group)
    if (!existsSync(base)) continue
    for (const name of readdirSync(base)) dirs.push(path.join(group, name))
  }
  return dirs.filter((dir) => existsSync(path.join(root, dir, "node_modules")))
}

function killGroup(child) {
  if (!child.pid) return
  try {
    process.kill(-child.pid, "SIGKILL")
  } catch {
    child.kill("SIGKILL")
  }
}

function runBehavior(tree) {
  const env = { ...process.env, NO_COLOR: "1" }
  delete env.NODE_TEST_CONTEXT
  delete env.FORCE_COLOR
  delete env.CLICOLOR_FORCE
  delete env.CLICOLOR
  return new Promise((resolve) => {
    const child = spawn(
      path.join(tree, "apps/api/node_modules/.bin/vitest"),
      ["run", "--maxWorkers=1", "src/connections/revoke-every-tool.test.ts"],
      {
        cwd: path.join(tree, "apps/api"),
        env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 110_000,
        killSignal: "SIGKILL",
      }
    )
    let output = ""
    const collect = (chunk) => {
      output += chunk
    }
    child.stdout.on("data", collect)
    child.stderr.on("data", collect)
    child.on("exit", () => killGroup(child))
    child.on("close", (status, signal) => {
      killGroup(child)
      resolve({ status, signal, output })
    })
    child.on("error", (error) => {
      killGroup(child)
      resolve({ status: 1, signal: null, output: String(error) })
    })
  })
}

test("a skipped live check fails the revoke outcome for every delegate tool", async () => {
  const original = readFileSync(path.join(root, BINDING), "utf8")
  assert.equal(original.split(LIVE_CHECK).length - 1, 1)
  assert.equal(original.includes(SKIPPED_CHECK), false)
  const scratchRoot = homedir()
  await withTempDir(
    "revoke-outcome-",
    async (dir) => {
      const tree = path.join(dir, "tree")
      try {
        git(["worktree", "add", "--detach", tree, "HEAD"])
        for (const rel of moduleDirs())
          symlinkSync(
            path.join(root, rel, "node_modules"),
            path.join(tree, rel, "node_modules")
          )
        copyFileSync(path.join(root, BEHAVIOR), path.join(tree, BEHAVIOR))
        const binding = path.join(tree, BINDING)
        const source = readFileSync(binding, "utf8")
        assert.equal(source.split(LIVE_CHECK).length - 1, 1)
        writeFileSync(binding, source.replace(LIVE_CHECK, SKIPPED_CHECK))
        const result = await runBehavior(tree)
        const crashed = CRASH.test(result.output)
        assert.equal(result.signal, null, result.output.slice(-2500))
        assert.equal(crashed, false, result.output.slice(-2500))
        assert.notEqual(result.status, 0, result.output.slice(-2500))
        assert.match(result.output, ASSERTED)
        assert.match(result.output, /no longer active|Private Job/)
      } finally {
        if (existsSync(path.join(tree, ".git"))) {
          try {
            git(["worktree", "remove", "--force", tree])
          } catch {
            rmSync(tree, { recursive: true, force: true })
            git(["worktree", "prune"])
          }
        }
        assert.equal(readFileSync(path.join(root, BINDING), "utf8"), original)
      }
    },
    path.join(scratchRoot, "tmp")
  )
})
