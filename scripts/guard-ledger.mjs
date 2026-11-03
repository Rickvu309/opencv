import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { withTempDir } from "./lib/temp-dir.mjs"

export const root = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  ".."
)
export const PROOFS_FILE = "scripts/guard-ledger.proofs.json"
const TEST_FILE = /\.(?:test|type-test)\.[cm]?[jt]sx?$|\/test\//
const DETECT_IMPORT = /import\s*\{[^}]*\bdetect\b[^}]*\}/

export const BASELINE_FILE = "scripts/guard-ledger.baseline.json"

export const LEDGER = Object.freeze([
  {
    id: "guard-ledger",
    file: "scripts/guard-ledger.test.mjs",
    historic: null,
    reason:
      "it guards the ledger itself; its fixtures fire on each mistake it catches",
  },
  {
    id: "tla-specs",
    file: "scripts/tla-specs.test.mjs",
    historic: null,
    reason:
      "it checks the formal specs and their runner, added in #917; no earlier mistake to prove yet",
  },
  {
    id: "read-invalidation",
    file: "apps/api/src/registry/invalidation.formal.test.ts",
    historic: null,
    reason:
      "its mutants run inside the file (a command without a read it changes, an undo without a read it refreshes); the four earlier stale-screen fixes were web-side and predate the command table",
  },
  {
    id: "ds-codemod",
    file: "scripts/ds-codemod.test.mjs",
    historic: null,
    reason:
      "added in #942 with the comment strip; the codemod kept install comments before, and its fresh-file fixture fires on that",
  },
  {
    id: "pointer-capture",
    file: "scripts/pointer-capture.test.mjs",
    detector: {
      module: "scripts/lib/pointer-capture.mjs",
      export: "missingDragEnds",
    },
    historic: {
      mode: "detect",
      sha: "70a4c349",
      path: "apps/web/src/features/landing/figures/motion.ts",
      fixed: {
        rev: "HEAD",
        path: "apps/web/src/features/app-shell/sidebar-resize-handle.tsx",
      },
    },
  },
  {
    id: "raw-tlc",
    file: "scripts/raw-tlc.test.mjs",
    historic: null,
    reason:
      "its one earlier mistake, commit 29d5d586, lives on a branch that will be deleted, so the test holds those lines inline and fires on them",
  },
  {
    id: "skills-tracked",
    file: "scripts/skills-tracked.test.mjs",
    detector: {
      module: "scripts/lib/ignored-skills.mjs",
      export: "skillIsIgnored",
    },
    historic: {
      mode: "detect",
      sha: "2c0c9582",
      path: ".gitignore",
      fixed: { rev: "HEAD", path: ".gitignore" },
    },
  },
  {
    id: "temp-dirs",
    file: "scripts/temp-dirs.test.mjs",
    historic: {
      mode: "revert",
      fix: "b680aafb",
      command: ["node", "--test", "scripts/temp-dirs.test.mjs"],
    },
  },
  {
    id: "touch-targets",
    file: "scripts/touch-targets.test.mjs",
    detector: {
      module: "scripts/lib/touch-targets.mjs",
      export: "smallTargets",
    },
    historic: {
      mode: "detect",
      sha: "6c0514b9^",
      path: "apps/web/src/features/app-shell/app-shell.tsx",
    },
  },
  {
    id: "unbounded-spawn",
    file: "scripts/unbounded-spawn.test.mjs",
    detector: {
      module: "scripts/lib/unbounded-spawn.mjs",
      export: "detectUnboundedSpawn",
    },
    historic: {
      mode: "detect",
      sha: "42da036c",
      path: "scripts/tlc.mjs",
      fixed: { rev: "HEAD", path: "scripts/tlc.mjs" },
    },
  },
])

export function guardFiles(trackedFiles, listGroupFiles, read) {
  const grouped = listGroupFiles(trackedFiles)
  const detectors = trackedFiles.filter(
    (file) =>
      /\.test\.[cm]?[jt]sx?$/.test(file) && DETECT_IMPORT.test(read(file))
  )
  return [...new Set([...grouped, ...detectors])].sort()
}

export function ledgerProblems({
  ledger = LEDGER,
  baseline = [],
  files,
  exists,
  proofs,
  hashOf,
}) {
  const problems = []
  const ids = new Set()
  const listed = new Set()
  for (const row of ledger) {
    if (ids.has(row.id)) problems.push(`${row.id}: id used by two rows`)
    ids.add(row.id)
    listed.add(row.file)
    if (!exists(row.file)) problems.push(`${row.id}: ${row.file} is missing`)
    if (row.historic === null) {
      if (!row.reason?.trim())
        problems.push(`${row.id}: historic is null and gives no reason`)
      continue
    }
    if (row.historic.mode === "detect") {
      if (!row.historic.fixed && !exists(row.historic.path))
        problems.push(
          `${row.id}: ${row.historic.path} is gone at HEAD, so "stays quiet" proves nothing. Name a fixed file in historic.fixed`
        )
      continue
    }
    const record = proofs[row.id]
    if (!record?.passed || record.fingerprint !== fingerprint(row, hashOf))
      problems.push(
        `${row.id}: no passing proof for its historic mistake, or the guard changed since. Run: node scripts/guard-ledger.mjs prove ${row.id}`
      )
  }
  const baselined = new Set(baseline)
  for (const file of baseline) {
    if (listed.has(file))
      problems.push(`${file}: has a row, so remove it from ${BASELINE_FILE}`)
    else if (!exists(file))
      problems.push(`${file}: is gone, so remove it from ${BASELINE_FILE}`)
  }
  for (const file of files)
    if (!listed.has(file) && !baselined.has(file))
      problems.push(
        `${file}: guard has no row. Add one to LEDGER in scripts/guard-ledger.mjs`
      )
  return problems
}

export function fingerprint(row, hashOf) {
  return createHash("sha1")
    .update(JSON.stringify({ historic: row.historic, guard: hashOf(row.file) }))
    .digest("hex")
    .slice(0, 12)
}

const hit = (result) => (Array.isArray(result) ? result.length > 0 : !!result)

const CRASH =
  /ERR_MODULE_NOT_FOUND|Cannot find module|SyntaxError|ERR_UNRESOLVED_PACKAGE/
const ASSERTED = /AssertionError|ERR_ASSERTION|^not ok|\bFAIL\b/m

export function failureKind(output) {
  if (CRASH.test(output)) return "crash"
  return ASSERTED.test(output) ? "assertion" : "unknown"
}

const outputLines = (output) =>
  output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)

const firstFailure = (output) => {
  const lines = outputLines(output)
  const at = lines.findIndex((line) => ASSERTED.test(line))
  return at === -1 ? [] : lines.slice(at, at + 3).map((line) => `    ${line}`)
}

const tailLines = (output, count = 4) =>
  outputLines(output)
    .slice(-count)
    .map((line) => `    ${line}`)

export async function proveDetect(row, io) {
  const { sha, path: file } = row.historic
  const quietAt = row.historic.fixed ?? { rev: "HEAD", path: file }
  const detect = await io.detector(row.detector)
  const past = io.show(sha, file)
  const now = io.show(quietAt.rev, quietAt.path)
  const fires = past !== null && hit(detect(past, file))
  const quiet = now !== null && !hit(detect(now, quietAt.path))
  return {
    ok: fires && quiet,
    lines: [
      `${sha}:${file} ${past === null ? "is missing" : fires ? "FIRES" : "stays quiet"} (must fire)`,
      `${quietAt.rev}:${quietAt.path} ${now === null ? "is gone, so this proves nothing (vacuous)" : quiet ? "stays quiet" : "FIRES"} (must stay quiet)`,
    ],
  }
}

export function proveRevert(row, io) {
  const { fix, command } = row.historic
  const files = io.changedFiles(fix).filter((file) => !TEST_FILE.test(file))
  if (files.length === 0)
    return { ok: false, lines: [`${fix} changes no non-test file`] }
  return io.inScratch((tree) => {
    try {
      tree.revert(fix, files)
    } catch (error) {
      return {
        ok: false,
        lines: [
          `reverse patch of ${fix} does not apply: ${String(error.message).split("\n")[0]}`,
        ],
      }
    }
    const reverted = tree.run(command)
    tree.reset()
    const restored = tree.run(command)
    const kind = reverted.passed ? "passes" : failureKind(reverted.output)
    return {
      ok: kind === "assertion" && restored.passed,
      lines: [
        `with ${fix} reverted on ${files.length} file(s): ${kind === "assertion" ? "FAILS on an assertion" : kind === "passes" ? "PASSES" : `FAILS FOR THE WRONG REASON (${kind}, not an assertion)`} (must fail on an assertion)`,
        ...firstFailure(reverted.output),
        ...tailLines(reverted.output),
        `at HEAD: ${restored.passed ? "PASSES" : "FAILS"} (must pass)`,
        ...(restored.passed ? [] : tailLines(restored.output)),
      ],
    }
  })
}

export function prove(row, io) {
  if (row.historic === null)
    return {
      ok: false,
      lines: [`${row.id} has no historic mistake: ${row.reason}`],
    }
  const { mode } = row.historic
  if (mode === "detect") return proveDetect(row, io)
  if (mode === "revert") return proveRevert(row, io)
  return { ok: false, lines: [`${row.id}: unknown mode ${mode}`] }
}

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })

export function runCommand(cwd, command) {
  const { NODE_TEST_CONTEXT: _outer, ...env } = process.env
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  })
  return {
    passed: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  }
}

const nodeModuleDirs = () => {
  const dirs = [""]
  for (const group of ["apps", "packages"])
    for (const name of readdirSync(path.join(root, group)))
      dirs.push(path.join(group, name))
  return dirs.filter((dir) => existsSync(path.join(root, dir, "node_modules")))
}

export const realIo = {
  async detector({ module, export: name }) {
    const loaded = await import(pathToFileURL(path.join(root, module)).href)
    return loaded[name]
  },
  show(rev, file) {
    try {
      return execFileSync("git", ["show", `${rev}:${file}`], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      })
    } catch {
      return null
    }
  },
  changedFiles(fix) {
    return git("diff", "--name-only", "--diff-filter=MD", `${fix}^`, fix)
      .split("\n")
      .filter(Boolean)
  },
  inScratch(run) {
    return withTempDir(
      "guard-ledger-",
      (dir) => {
        const tree = path.join(dir, "tree")
        git("worktree", "add", "--detach", tree, "HEAD")
        try {
          for (const rel of nodeModuleDirs())
            symlinkSync(
              path.join(root, rel, "node_modules"),
              path.join(tree, rel, "node_modules")
            )
          const inTree = (...args) =>
            execFileSync("git", args, { cwd: tree, encoding: "utf8" })
          return run({
            revert(fix, files) {
              const patch = git(
                "diff",
                "--binary",
                `${fix}^`,
                fix,
                "--",
                ...files
              )
              execFileSync("git", ["apply", "-R", "--whitespace=nowarn"], {
                cwd: tree,
                input: patch,
              })
            },
            reset() {
              inTree("reset", "--hard")
              inTree("clean", "-fd")
            },
            run: (command) => runCommand(tree, command),
          })
        } finally {
          git("worktree", "remove", "--force", tree)
        }
      },
      path.join(homedir(), "tmp")
    )
  },
}

export function readProofs(file = path.join(root, PROOFS_FILE)) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
}

export const readBaseline = () =>
  JSON.parse(readFileSync(path.join(root, BASELINE_FILE), "utf8"))

export const hashOfFile = (file) =>
  createHash("sha1")
    .update(readFileSync(path.join(root, file)))
    .digest("hex")

const uncommitted = () =>
  git("status", "--porcelain")
    .split("\n")
    .filter((line) => line && !line.endsWith(PROOFS_FILE))

async function main(argv) {
  const [command, id] = argv
  const row = LEDGER.find((candidate) => candidate.id === id)
  if (command !== "prove" || !row) {
    console.error(
      `usage: node scripts/guard-ledger.mjs prove <id>\nids with a historic mistake: ${LEDGER.filter(
        (r) => r.historic
      )
        .map((r) => r.id)
        .join(", ")}`
    )
    return 2
  }
  const dirty = uncommitted()
  if (dirty.length > 0) {
    console.error(
      `commit your changes first; a proof reads committed files.\n${dirty.join("\n")}`
    )
    return 2
  }
  const result = await prove(row, realIo)
  console.log(`${row.id} (${row.historic?.mode ?? "no historic"})`)
  for (const line of result.lines) console.log(`  ${line}`)
  if (!result.ok) {
    console.log("FAIL")
    return 1
  }
  if (row.historic.mode === "detect") {
    console.log(
      "PASS (the ledger test re-runs detect proofs, so none is recorded)"
    )
    return 0
  }
  const proofs = readProofs()
  proofs[row.id] = { passed: true, fingerprint: fingerprint(row, hashOfFile) }
  const sorted = Object.fromEntries(Object.entries(proofs).sort())
  writeFileSync(
    path.join(root, PROOFS_FILE),
    `${JSON.stringify(sorted, null, 2)}\n`
  )
  console.log("PASS, recorded in", PROOFS_FILE)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = await main(process.argv.slice(2))
