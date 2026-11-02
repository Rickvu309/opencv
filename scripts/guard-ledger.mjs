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

const BACKFILLED = "backfilled with the ledger; no past mistake recorded yet"
const idOf = (file) =>
  path.posix
    .basename(file)
    .replace(/\.(?:type-)?test\.[cm]?[jt]sx?$/, "")
    .replace(/-guard$/, "")

const guard = (file, extra = {}) => {
  const row = { id: idOf(file), file, historic: null, ...extra }
  if (row.historic === null) row.reason = extra.reason ?? BACKFILLED
  return row
}

export const LEDGER = Object.freeze([
  guard("scripts/adr-citations.test.mjs"),
  guard("scripts/approve-railway-deploys.test.mjs"),
  guard("scripts/blocknote-dependencies.test.mjs"),
  guard("scripts/browser-launcher.test.mjs"),
  guard("scripts/check.test.mjs"),
  guard("scripts/checks-doc.test.mjs"),
  guard("scripts/ci-screens.test.mjs"),
  guard("scripts/ci-workflow.test.mjs"),
  guard("scripts/doc-paths.test.mjs"),
  guard("scripts/driver-sign-in.test.mjs"),
  guard("scripts/focus-indication.test.mjs"),
  guard("scripts/guard-ledger.test.mjs"),
  guard("scripts/kit-duplicates.test.mjs"),
  guard("scripts/layout-comparison-gates.test.mjs"),
  guard("scripts/nav-pending.test.mjs"),
  guard("scripts/no-comments.test.mjs"),
  guard("scripts/paper-save-keeps-parts.test.mjs"),
  guard("scripts/pen-snapshot.test.mjs"),
  guard("scripts/pointer-capture.test.mjs", {
    detector: {
      module: "scripts/lib/pointer-capture.mjs",
      export: "missingDragEnds",
    },
    historic: {
      mode: "detect",
      sha: "70a4c349",
      path: "apps/web/src/features/landing/figures/motion.ts",
    },
  }),
  guard("scripts/retired-words.test.mjs"),
  guard("scripts/skill-routes.test.mjs"),
  guard("scripts/temp-dirs.test.mjs", {
    historic: {
      mode: "revert",
      fix: "b680aafb",
      command: ["node", "--test", "scripts/temp-dirs.test.mjs"],
    },
  }),
  guard("scripts/touch-targets.test.mjs", {
    detector: {
      module: "scripts/lib/touch-targets.mjs",
      export: "smallTargets",
    },
    historic: {
      mode: "detect",
      sha: "6c0514b9^",
      path: "apps/web/src/features/app-shell/app-shell.tsx",
    },
  }),
  guard("scripts/unused-domain-exports.test.mjs"),
  guard("scripts/verify-auth-production.test.mjs"),
  guard("scripts/verify-feature-map.test.mjs"),
  guard("scripts/web-lint-rules.test.mjs"),
  guard("scripts/web-test-clock.test.mjs"),
  guard("packages/guards/run-tests.test.mjs"),
  guard("packages/guards/shell-suites.test.mjs"),
  guard("packages/guards/test-completeness.test.mjs"),
  guard("packages/guards/wall-clock.test.mjs"),
  guard("packages/guards/workspace-scripts.test.mjs"),
  guard("apps/web/src/test/deploy-config.test.ts"),
  guard("apps/web/src/test/design-frame-coverage.test.ts"),
  guard("apps/web/src/test/design-vocabulary.test.ts"),
  guard("apps/web/src/test/disclosure-buttons.test.ts"),
  guard("apps/web/src/test/feature-imports.test.ts"),
  guard("apps/web/src/test/landing-art-rotation.test.ts"),
  guard("apps/web/src/test/landing-button.test.ts"),
  guard("apps/web/src/test/module-isolation.test.ts"),
  guard("apps/web/src/test/nav-contract.test.tsx"),
  guard("apps/web/src/test/no-use-state.test.ts"),
  guard("apps/web/src/test/page-header-guard.test.ts"),
  guard("apps/web/src/test/quarantine-expiry.test.ts"),
  guard("apps/web/src/test/rejected-command.test.ts"),
  guard("apps/web/src/test/render-app-cleanup.test.tsx"),
  guard("apps/web/src/test/request-boundary.test.ts"),
  guard("apps/web/src/test/sonner-cleanup.test.tsx"),
  guard("apps/web/src/test/surface-behavior.test.tsx"),
  guard("apps/web/src/test/test-resources.test.ts"),
  guard("apps/web/src/test/ui-kit-contract.test.ts"),
  guard("apps/web/src/test/ui-kit-styled.test.ts"),
  guard("apps/web/src/test/verify-assumptions.test.ts"),
  guard("apps/web/src/test/warm-routes.test.ts"),
  guard("apps/api/src/chat/chat-contract.test.ts"),
  guard("apps/api/src/registry/acceptance.test.ts"),
  guard("apps/api/src/registry/account-contract.test.ts"),
  guard("apps/api/src/registry/behavior.test.ts"),
  guard("apps/api/src/registry/boundaries.test.ts"),
  guard("apps/api/src/registry/coach-chat-tools.test.ts"),
  guard("apps/api/src/registry/coverage.test.ts"),
  guard("apps/api/src/registry/gates.test.ts"),
  guard("apps/api/src/registry/inbox-contract.test.ts"),
  guard("apps/api/src/registry/job-contract.test.ts"),
  guard("apps/api/src/registry/names.test.ts"),
  guard("apps/api/src/registry/ownership.test.ts"),
  guard("apps/api/src/registry/paper-contract.test.ts"),
  guard("apps/api/src/registry/registry.formal.test.ts"),
  guard("apps/api/src/registry/registry.pending.formal.test.ts"),
  guard("apps/api/src/registry/registry.undo.formal.test.ts"),
  guard("apps/api/src/registry/transaction.test.ts"),
])

export function guardFiles(trackedFiles, listGroupFiles, read) {
  const grouped = listGroupFiles(trackedFiles)
  const detectors = trackedFiles.filter(
    (file) =>
      /\.test\.[cm]?[jt]sx?$/.test(file) && DETECT_IMPORT.test(read(file))
  )
  return [...new Set([...grouped, ...detectors])].sort()
}

export function ledgerProblems({ ledger = LEDGER, files, exists, proofs }) {
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
    const record = proofs[row.id]
    if (!record?.passed || record.fingerprint !== fingerprint(row))
      problems.push(
        `${row.id}: no passing proof for its historic mistake. Run: node scripts/guard-ledger.mjs prove ${row.id}`
      )
  }
  for (const file of files)
    if (!listed.has(file))
      problems.push(
        `${file}: guard has no row. Add one to LEDGER in scripts/guard-ledger.mjs`
      )
  return problems
}

export function fingerprint(row) {
  return createHash("sha1")
    .update(JSON.stringify({ detector: row.detector, historic: row.historic }))
    .digest("hex")
    .slice(0, 12)
}

const hit = (result) => (Array.isArray(result) ? result.length > 0 : !!result)

export async function proveDetect(row, io) {
  const { sha, path: file } = row.historic
  const detect = await io.detector(row.detector)
  const past = io.show(sha, file)
  const now = io.show("HEAD", file)
  const fires = past !== null && hit(detect(past, file))
  const quiet = now === null || !hit(detect(now, file))
  return {
    ok: fires && quiet,
    lines: [
      `${sha}:${file} ${past === null ? "is missing" : fires ? "FIRES" : "stays quiet"} (must fire)`,
      `HEAD:${file} ${now === null ? "is gone" : quiet ? "stays quiet" : "FIRES"} (must stay quiet)`,
    ],
  }
}

export function proveRevert(row, io) {
  const { fix, command } = row.historic
  const files = io.changedFiles(fix).filter((file) => !TEST_FILE.test(file))
  if (files.length === 0)
    return { ok: false, lines: [`${fix} changes no non-test file`] }
  return io.inScratch((tree) => {
    tree.revert(fix, files)
    const reverted = tree.run(command)
    tree.reset()
    const restored = tree.run(command)
    return {
      ok: !reverted && restored,
      lines: [
        `with ${fix} reverted on ${files.length} file(s): ${reverted ? "PASSES" : "FAILS"} (must fail)`,
        `at HEAD: ${restored ? "PASSES" : "FAILS"} (must pass)`,
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
    return git("diff", "--name-only", `${fix}^`, fix)
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
              inTree("checkout", "--", ".")
            },
            run(command) {
              const { NODE_TEST_CONTEXT: _outer, ...env } = process.env
              return (
                spawnSync(command[0], command.slice(1), {
                  cwd: tree,
                  env,
                  stdio: "ignore",
                }).status === 0
              )
            },
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
  const result = await prove(row, realIo)
  console.log(`${row.id} (${row.historic?.mode ?? "no historic"})`)
  for (const line of result.lines) console.log(`  ${line}`)
  if (!result.ok) {
    console.log("FAIL")
    return 1
  }
  const proofs = readProofs()
  proofs[row.id] = { passed: true, fingerprint: fingerprint(row) }
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
