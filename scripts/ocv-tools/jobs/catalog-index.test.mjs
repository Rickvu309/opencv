import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../../lib/temp-dir.mjs"
import { isolatedEnv } from "../ports/proc.mjs"

const TOOL = fileURLToPath(new URL("../../ocv-tools.mjs", import.meta.url))
const OPS = "packages/domain/src/operations"
const GENERATED = "packages/domain/src/generated/catalog.ts"
const SCRATCH = join(process.env.HOME ?? "", "tmp", "ocv-tools", "scratch-dirs")

const STAND_IN_GENERATOR = `import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
const GENERATED = "${GENERATED}"
export async function judgeCatalog(directory) {
  const base = path.join(directory, "${OPS}")
  const names = existsSync(base)
    ? readdirSync(base).sort().map((dir) => readFileSync(path.join(base, dir, "operation.ts"), "utf8").trim())
    : []
  const expected = { [GENERATED]: names.join("\\n") + "\\n" }
  const file = path.join(directory, GENERATED)
  return { expected, current: existsSync(file) ? { [GENERATED]: readFileSync(file, "utf8") } : {} }
}
if (process.argv[2] === "generate") {
  const { expected } = await judgeCatalog(process.cwd())
  mkdirSync(path.dirname(GENERATED), { recursive: true })
  writeFileSync(GENERATED, expected[GENERATED])
}
`

function repo(t) {
  const dir = tempDir(t, "catalog-index-")
  const top = join(dir, "repo")
  const hooks = join(dir, "hooks")
  mkdirSync(top)
  mkdirSync(hooks)
  writeFileSync(
    join(hooks, "pre-commit"),
    `#!/bin/sh\nexec "${process.execPath}" "${TOOL}" hook pre-commit "$@"\n`
  )
  chmodSync(join(hooks, "pre-commit"), 0o755)
  const env = isolatedEnv(process.env)
  const sh = (cmd, args) =>
    spawnSync(cmd, args, { cwd: top, env, encoding: "utf8" })
  const git = (...args) => {
    const r = sh("git", args)
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}${r.stdout}`)
    return r.stdout
  }
  const write = (file, text) => {
    mkdirSync(dirname(join(top, file)), { recursive: true })
    writeFileSync(join(top, file), text)
  }
  const op = (folder, name = `job.${folder}`) => {
    write(`${OPS}/${folder}/operation.ts`, `${name}\n`)
    write(`apps/api/src/job/operations/${folder}/server.ts`, `${name}\n`)
  }
  const generate = () => {
    const r = sh(process.execPath, ["scripts/catalog.mjs", "generate"])
    assert.equal(r.status, 0, r.stderr)
  }
  const commit = (...args) => {
    const r = sh("git", [
      "-c",
      `core.hooksPath=${hooks}`,
      "commit",
      "--quiet",
      ...args,
    ])
    return { ok: r.status === 0, text: `${r.stdout}${r.stderr}` }
  }
  git("init", "--quiet", "--initial-branch=feat/1-catalog")
  git("config", "user.email", "t@example.com")
  git("config", "user.name", "t")
  write("scripts/catalog.mjs", STAND_IN_GENERATOR)
  write("README.md", "probe\n")
  op("alpha")
  generate()
  git("add", "-A")
  assert.ok(commit("-m", "base").ok)
  return { top, git, write, op, generate, commit }
}

const refusedStale = (result) => {
  assert.equal(result.ok, false, result.text)
  assert.match(
    result.text,
    /REFUSED CATALOG_STALE: the tree this commit records has a stale generated contract catalog: packages\/domain\/src\/generated\/catalog\.ts/
  )
}

const scratchLeft = () => {
  try {
    return readdirSync(SCRATCH).filter((name) =>
      name.startsWith("catalog-index-")
    )
  } catch {
    return []
  }
}

test("the reviewer's sequence: an untracked operation, generate, then commit -a is refused by name", (t) => {
  const r = repo(t)
  r.op("beta")
  r.generate()
  const result = r.commit("-a", "-m", "catalog only")
  assert.equal(result.ok, false, result.text)
  assert.match(
    result.text,
    /these operation files are not staged: apps\/api\/src\/job\/operations\/beta\/server\.ts, packages\/domain\/src\/operations\/beta\/operation\.ts; add them or remove them, then commit/
  )
})

test("staged sources with a stale staged catalog are refused", (t) => {
  const r = repo(t)
  r.op("beta")
  r.git("add", "-A")
  refusedStale(r.commit("-m", "no generate"))
})

test("a correct staged pair passes while the working tree is stale", (t) => {
  const r = repo(t)
  r.op("beta")
  r.generate()
  r.git("add", "-A")
  r.write(GENERATED, "garbage\n")
  r.write(`${OPS}/alpha/operation.ts`, "job.renamedOnDisk\n")
  const result = r.commit("-m", "beta")
  assert.ok(result.ok, result.text)
})

test("a stale staged pair is refused while the working tree is correct", (t) => {
  const r = repo(t)
  r.op("beta")
  r.git("add", "-A")
  r.generate()
  refusedStale(r.commit("-m", "generated after staging"))
})

function stageContent(r, file, text) {
  r.write(file, text)
  const blob = r.git("hash-object", "-w", file).trim()
  r.git("update-index", "--cacheinfo", `100644,${blob},${file}`)
}

test("a partly staged operation file is judged by its staged content", (t) => {
  const file = `${OPS}/alpha/operation.ts`
  const fresh = repo(t)
  stageContent(fresh, file, "job.alphaStaged\n")
  stageContent(fresh, GENERATED, "job.alphaStaged\n")
  fresh.write(file, "job.alphaStaged\njob.unstagedHunk\n")
  fresh.write(GENERATED, "garbage\n")
  const passed = fresh.commit("-m", "staged hunk with its catalog")
  assert.ok(passed.ok, passed.text)
  const stale = repo(t)
  stageContent(stale, file, "job.alphaStaged\n")
  stageContent(stale, GENERATED, "job.alphaOnDisk\n")
  stale.write(file, "job.alphaOnDisk\n")
  refusedStale(stale.commit("-m", "catalog matches the disk, not the index"))
})

test("a renamed operation is refused until the catalog is regenerated", (t) => {
  const r = repo(t)
  r.git("mv", `${OPS}/alpha`, `${OPS}/gamma`)
  r.write(`${OPS}/gamma/operation.ts`, "job.gamma\n")
  r.git("add", "-A")
  refusedStale(r.commit("-m", "rename"))
  r.generate()
  r.git("add", "-A")
  const result = r.commit("-m", "rename with catalog")
  assert.ok(result.ok, result.text)
})

test("a deleted operation is refused until the catalog is regenerated", (t) => {
  const r = repo(t)
  r.op("beta")
  r.generate()
  r.git("add", "-A")
  assert.ok(r.commit("-m", "beta").ok)
  r.git(
    "rm",
    "-r",
    "--quiet",
    `${OPS}/beta`,
    "apps/api/src/job/operations/beta"
  )
  refusedStale(r.commit("-m", "delete"))
  r.generate()
  r.git("add", "-A")
  const result = r.commit("-m", "delete with catalog")
  assert.ok(result.ok, result.text)
})

function diverged(r) {
  r.git("checkout", "--quiet", "-b", "feat/2-theirs")
  r.op("theirs")
  r.generate()
  r.git("add", "-A")
  assert.ok(r.commit("-m", "someone else's operation").ok)
  r.git("checkout", "--quiet", "feat/1-catalog")
  r.op("mine")
  r.generate()
  r.git("add", "-A")
  assert.ok(r.commit("-m", "my operation").ok)
}

for (const how of ["merge", "rebase"])
  test(`a ${how} that brings in someone else's operation passes with a regenerated catalog and is refused with a stale one, without blaming the person`, (t) => {
    for (const resolution of ["regenerated", "stale"]) {
      const r = repo(t)
      diverged(r)
      const start =
        how === "merge"
          ? spawnSync("git", ["merge", "--no-edit", "feat/2-theirs"], {
              cwd: r.top,
              env: isolatedEnv(process.env),
              encoding: "utf8",
            })
          : spawnSync("git", ["rebase", "feat/2-theirs"], {
              cwd: r.top,
              env: isolatedEnv(process.env),
              encoding: "utf8",
            })
      assert.notEqual(start.status, 0, "the generated catalog conflicts")
      if (resolution === "regenerated") r.generate()
      else r.git("checkout", "--ours", "--", GENERATED)
      r.git("add", "-A")
      const result = r.commit("--no-edit")
      if (resolution === "regenerated") assert.ok(result.ok, result.text)
      else {
        refusedStale(result)
        assert.doesNotMatch(result.text, /\byour\b|\byou\b/i)
      }
    }
  })

test("--amend is judged on the amended tree", (t) => {
  const r = repo(t)
  r.op("beta")
  r.git("add", "-A")
  refusedStale(r.commit("--amend", "--no-edit"))
  r.generate()
  r.git("add", "-A")
  const result = r.commit("--amend", "--no-edit")
  assert.ok(result.ok, result.text)
})

test("a docs-only commit never copies the index, and no scratch folder is left behind", (t) => {
  const before = scratchLeft()
  const r = repo(t)
  r.write("README.md", "more\n")
  r.git("add", "README.md")
  assert.ok(r.commit("-m", "docs").ok)
  r.op("beta")
  r.git("add", "-A")
  refusedStale(r.commit("-m", "stale"))
  assert.deepEqual(scratchLeft(), before)
  rmSync(join(r.top, OPS, "beta"), { recursive: true, force: true })
})
