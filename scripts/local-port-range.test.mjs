import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { FIX, PORT_SOURCE, detect } from "./lib/local-port-range.mjs"
import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const GIT_TIMEOUT_MS = 30_000
const MAIN_BEFORE_SHARED_RANGE = "b01120dd"
const SCANNED_ROOTS = [
  "scripts",
  ".claude/skills",
  "apps",
  "packages",
  "docs",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CONTEXT.md",
]
const SCANNED_FILE = /\.(?:[cm]?[jt]sx?|sh|md)$/
const HOLDS_MISTAKE_FIXTURES = ["scripts/local-port-range.test.mjs"]

const PENDING = [
  ".claude/skills/verify-app-ui/SKILL.md",
  ".claude/skills/verify-app-ui/apply-pen.md",
  ".claude/skills/verify-app-ui/scripts/lib/stack.mjs",
  ".claude/skills/verify-app-ui/scripts/verify-app-ui.mjs",
  ".claude/skills/verify-app-ui/scripts/verify-auth-code.mjs",
  ".claude/skills/verify-app-ui/scripts/verify-pen-layout.mjs",
  "docs/agents/design-parity.md",
  "scripts/ocv-tools/worktree.mjs",
].map((file) => ({ file, issue: "#1002", expires: "2026-11-24" }))

const MISTAKES = [
  [
    "verify.mjs",
    "const base = Number(process.env.PORT ?? 4450)\nif (!(base >= 4450 && base <= 4458)) process.exit(2)",
  ],
  ["worktree.mjs", "let port = 4000 + (issue % 1000)"],
  ["worktree.mjs", 'if (port >= 65535) throw new Error("no free port")'],
  ["launch.sh", '[ "$PORT" -ge 4450 ] || exit 2'],
  ["verify.mjs", 'throw new Error("PORT must be 4450 to 4458")'],
  ["SKILL.md", "Run `PORT=4450 pnpm --filter web verify:pen-layout`."],
]
const CLEAN = [
  [
    "verify.mjs",
    "if (!(base >= WORKTREE_PORTS.first && base <= WORKTREE_PORTS.last)) exit()",
  ],
  ["verify.mjs", "const port = Number(process.env.PORT)"],
  ["verify.mjs", "if (viewport.width >= 1440) wide()"],
  ["verify.mjs", "const valid = (port) => port > 0"],
  ["verify.mjs", "const timeoutMs = 30000\nawait listen(port)"],
  [
    "SKILL.md",
    "Run `PORT=$(sed -n 's/^PORT=//p' .env) pnpm --filter web verify:pen-layout`.",
  ],
  [PORT_SOURCE, "const valid = parsed > 0 && parsed <= 65535 && port"],
]

const git = (args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: GIT_TIMEOUT_MS,
  })

const scannedFiles = () =>
  git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    ...SCANNED_ROOTS,
  ])
    .split("\n")
    .filter((file) => SCANNED_FILE.test(file))
    .filter((file) => !HOLDS_MISTAKE_FIXTURES.includes(file))

const offends = (file) =>
  detect(readFileSync(path.join(root, file), "utf8"), file).length > 0

test("a literal port range or fixed verifier port is refused", () => {
  for (const [file, text] of MISTAKES)
    assert.ok(detect(text, file).length > 0, `${file}: ${text}`)
  for (const [file, text] of CLEAN)
    assert.deepEqual(detect(text, file), [], `${file}: ${text}`)
})

test("every port check reads the shared range and no tool keeps its own", () => {
  const pending = new Set(PENDING.map((entry) => entry.file))
  const offenders = scannedFiles()
    .filter((file) => !pending.has(file))
    .flatMap((file) =>
      detect(readFileSync(path.join(root, file), "utf8"), file).map(
        (hit) => `${file}:${hit.line} ${hit.text}`
      )
    )
  assert.deepEqual(offenders, [], `${FIX}\n${offenders.join("\n")}`)
})

test("every pending entry is unexpired and still needs its entry", () => {
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
  const stale = PENDING.filter((entry) => !offends(entry.file))
  assert.deepEqual(
    stale.map((entry) => entry.file),
    [],
    "these files no longer carry their own port range; delete their PENDING entries"
  )
})

test("the allocator on main before the shared range is caught", (t) => {
  let old
  try {
    old = git([
      "show",
      `${MAIN_BEFORE_SHARED_RANGE}:scripts/ocv-tools/worktree.mjs`,
    ])
  } catch {
    return t.skip(`commit ${MAIN_BEFORE_SHARED_RANGE} is not in this clone`)
  }
  assert.deepEqual(
    detect(old, "scripts/ocv-tools/worktree.mjs").flatMap((hit) => hit.ports),
    ["4000", "65535"]
  )
})
