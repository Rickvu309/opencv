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
import ts from "typescript"
import { withTempDir } from "../lib/temp-dir.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")
const BINDING = "apps/api/src/connections/http.ts"
const BEHAVIOR = "apps/api/src/connections/revoke-every-tool.test.ts"
const LIVE_CHECK = "await requireLiveDelegate(actor)"
const SKIPPED_CHECK = "if (false) await requireLiveDelegate(actor)"
const DEFERRED = `const run = await transaction(async () => {
                await requireLiveDelegate(actor)
                return async () => entry.kind === "query"
                  ? { data: await registry.read(entry.name, input, actor) }
                  : registry.execute({ name: entry.name, input, actor })
              })
              const result = await run()`
const AFTER_READ = `const result = await transaction(async () => {
                if (
                  entry.kind === "query" &&
                  (entry.name === "job.list" || entry.name === "job.get")
                ) {
                  const data = await registry.read(entry.name, input, actor)
                  process.stderr.write(
                    "REVIEW_PRECHECK_READ " + entry.name + " " + JSON.stringify(data)
                  )
                }
                await requireLiveDelegate(actor)
                return entry.kind === "query"
                  ? { data: await registry.read(entry.name, input, actor) }
                  : registry.execute({ name: entry.name, input, actor })
              })`
const CRASH =
  /ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError|ERR_UNRESOLVED_PACKAGE/
const ASSERTED = /AssertionError|ERR_ASSERTION|^not ok|\bFAIL\b/m
const ORDER = /no longer active|Private Job|live check|same transaction/

function hasLiveCheck(root) {
  let found = false
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "requireLiveDelegate"
    )
      found = true
    ts.forEachChild(node, visit)
  }
  visit(root)
  return found
}

function replaceToolTransaction(text, replacement) {
  const source = ts.createSourceFile(
    BINDING,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const blocks = []
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "result" &&
      node.initializer &&
      ts.isAwaitExpression(node.initializer) &&
      ts.isCallExpression(node.initializer.expression)
    ) {
      const call = node.initializer.expression
      const body = call.arguments[0]
      if (
        ts.isIdentifier(call.expression) &&
        call.expression.text === "transaction" &&
        body &&
        ts.isArrowFunction(body) &&
        hasLiveCheck(body) &&
        ts.isVariableDeclarationList(node.parent) &&
        ts.isVariableStatement(node.parent.parent)
      )
        blocks.push(node.parent.parent)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.equal(blocks.length, 1, "one checked tool transaction")
  const block = blocks[0]
  return (
    text.slice(0, block.getStart(source)) + replacement + text.slice(block.end)
  )
}

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
      [
        "run",
        "--bail=1",
        "--maxWorkers=1",
        "src/connections/revoke-every-tool.test.ts",
      ],
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

function expectFailure(result) {
  const crashed = CRASH.test(result.output)
  const tail = result.output.slice(-2500)
  assert.equal(result.signal, null, tail)
  assert.equal(crashed, false, tail)
  assert.notEqual(result.status, 0, tail)
  assert.match(result.output, ASSERTED)
  assert.match(result.output, ORDER)
}

test("skipped, deferred, and early reads fail the revoke outcome", async () => {
  const original = readFileSync(path.join(root, BINDING), "utf8")
  assert.equal(original.split(LIVE_CHECK).length - 1, 1)
  assert.equal(original.includes(SKIPPED_CHECK), false)
  assert.notEqual(replaceToolTransaction(original, DEFERRED), original)
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
        const mutants = [
          source.replace(LIVE_CHECK, SKIPPED_CHECK),
          replaceToolTransaction(source, DEFERRED),
          replaceToolTransaction(source, AFTER_READ),
        ]
        assert.equal(mutants[0].includes(SKIPPED_CHECK), true)
        assert.equal(mutants[1].split(LIVE_CHECK).length - 1, 1)
        assert.equal(mutants[2].split(LIVE_CHECK).length - 1, 1)
        assert.equal(mutants[1].includes("const result = await run()"), true)
        assert.equal(mutants[2].includes("REVIEW_PRECHECK_READ"), true)
        for (const next of mutants) {
          assert.notEqual(next, source)
          writeFileSync(binding, next)
          expectFailure(await runBehavior(tree))
        }
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
