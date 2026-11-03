import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { WORKTREE_PORTS } from "../packages/domain/src/local-ports.ts"
import {
  FIX,
  PENDING_FILE,
  PORT_SOURCE,
  detect,
  pendingGrowth,
  pinDrift,
} from "./lib/local-port-range.mjs"
import { resolveApiPort, verifierPorts } from "./lib/worktree-port.mjs"
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

const PENDING_ISSUE = "#1002"
const PENDING_LAST_DAY = "2026-11-24"
const PENDING = JSON.parse(readFileSync(path.join(root, PENDING_FILE), "utf8"))

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
  ["verify.mjs", "const API_PORT = env()\nif (API_PORT >= 4450) exit()"],
  ["verify.mjs", "const WEB_PORTS = []\nif (count > 2000) x"],
]
const CLEAN = [
  [
    "verify.mjs",
    "if (!(base >= WORKTREE_PORTS.first && base <= WORKTREE_PORTS.last)) exit()",
  ],
  ["verify.mjs", "const port = Number(process.env.PORT)"],
  ["verify.mjs", "if (viewport.width >= 1440) wide()"],
  ["verify.mjs", "const valid = (port) => port > 0"],
  ["verify.mjs", "const retryLimit = 30000\nawait listen(port)"],
  [
    "SKILL.md",
    "Run `PORT=$(sed -n 's/^PORT=//p' .env) pnpm --filter web verify:pen-layout`.",
  ],
  [PORT_SOURCE, "const valid = parsed > 0 && parsed <= 65535 && port"],
  ["verify.mjs", 'const REPORT_DIR = "x"\nif (count > 2000) x'],
  ["verify.mjs", "const EXPORT_LIMIT = 5\nif (rows.length > 2000) x"],
  ["verify.mjs", "const IMPORT_BATCH = 1\nif (count > 2000) x"],
  ["verify.mjs", "const SUPPORT = true\nif (count > 2000) x"],
  ["verify.mjs", "export function f() {}\nif (count > 2000) x"],
  ["verify.mjs", "const report = load()\nif (count > 2000) x"],
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

const hitCount = (file) =>
  detect(readFileSync(path.join(root, file), "utf8"), file).length

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

test("every pending entry is unexpired and pins its exact hit count", () => {
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
  for (const entry of PENDING) {
    assert.equal(entry.issue, PENDING_ISSUE, entry.file)
    assert.ok(entry.expires <= PENDING_LAST_DAY, entry.file)
    assert.ok(Number.isInteger(entry.hits) && entry.hits > 0, entry.file)
  }
  assert.deepEqual(pinDrift(PENDING, hitCount), [])
})

test("a pending file that gains or loses a hit fails its pin", () => {
  const pinned = [{ file: "a.mjs", hits: 2 }]
  assert.match(pinDrift(pinned, () => 3).join(), /allows 2/)
  assert.match(pinDrift(pinned, () => 1).join(), /Lower its pin to 1/)
  assert.deepEqual(
    pinDrift(pinned, () => 2),
    []
  )
})

test("the pending list only shrinks", (t) => {
  const old = { file: "a.mjs", hits: 2, issue: "#1002", expires: "2026-11-24" }
  assert.deepEqual(pendingGrowth([{ ...old, hits: 1 }], [old]), [])
  assert.deepEqual(pendingGrowth([], [old]), [])
  assert.match(
    pendingGrowth([old, { ...old, file: "b.mjs" }], [old]).join(),
    /b.mjs is a new pending entry/
  )
  assert.match(pendingGrowth([{ ...old, hits: 3 }], [old]).join(), /up from 2/)
  assert.match(
    pendingGrowth([{ ...old, expires: "2026-12-01" }], [old]).join(),
    /only shrinks/
  )
  let onMain
  try {
    onMain = JSON.parse(git(["show", `origin/main:${PENDING_FILE}`]))
  } catch {
    return t.skip(`${PENDING_FILE} is not on origin/main yet`)
  }
  assert.deepEqual(pendingGrowth(PENDING, onMain), [])
})

test("a verifier web port is never an api port in the shared range", () => {
  const apis = []
  for (let port = WORKTREE_PORTS.first; port <= WORKTREE_PORTS.last; port += 1)
    apis.push(port)
  const apiSet = new Set(apis)
  const band = WORKTREE_PORTS.last - WORKTREE_PORTS.first + 1
  for (const apiPort of apis) {
    const ports = verifierPorts(apiPort)
    assert.ok(ports, String(apiPort))
    assert.equal(apiSet.has(ports.webPort), false)
    assert.equal(ports.webPort, apiPort + band)
    assert.ok(ports.webPort > WORKTREE_PORTS.last)
    assert.ok(ports.webPort <= WORKTREE_PORTS.last + band)
  }
  assert.equal(verifierPorts(WORKTREE_PORTS.first - 1), null)
  assert.equal(verifierPorts(WORKTREE_PORTS.last + 1), null)
  assert.equal(resolveApiPort({ envText: "PORT=4402\n" }), 4402)
  assert.equal(
    resolveApiPort({ envPort: "4500", envText: "PORT=4402\n" }),
    4500
  )
  assert.equal(resolveApiPort({ envPort: "99", envText: "PORT=4402\n" }), null)
  assert.equal(resolveApiPort({ envText: 'PORT="4408"\n' }), 4408)
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
