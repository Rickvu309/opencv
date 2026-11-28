import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { WORKTREE_PORTS } from "../../packages/domain/src/local-ports.ts"
import { runCli } from "./cli.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { ctxFor, fakePorts, issue, minutesAgo, pr } from "./ports/fake.mjs"
import {
  RESERVED_WEB_PORTS,
  buildCommand,
  packagesUsedFromBuiltOutput,
  pickPort,
  slugify,
} from "./worktree.mjs"

const WT = "/tmp/opencv.worktrees/90-keep-my-search"
const BRANCH = "feat/90-keep-my-search"

const claim = (agent, minutes, id = 1) => ({
  databaseId: id,
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({ agent, at: "client", branch: BRANCH }),
})

function run(over = {}, extra = {}) {
  const ports = fakePorts(over)
  return { ports, ctx: ctxFor(ports, extra) }
}

const filed = [
  "feat: Keep my search",
  "--what",
  "The page forgets your search. This keeps it.",
  "--done",
  "- I come back and the box still has my words.",
  "--risk",
  "low",
  "--no-install",
]

test("slugify keeps the first five words", () => {
  assert.equal(
    slugify("Keep my search: now, please! Really long"),
    "keep-my-search-now-please"
  )
  assert.equal(slugify("!!!"), "")
})

test("take builds the branch, worktree, .env, port record, owner note and result", () => {
  const { ports, ctx } = run({
    dirs: [`${WT}/.githooks`],
    hooksPath: "/dev/null",
  })
  const r = runCli(["take", "90", "--no-install"], ctx)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, new RegExp(`Worktree: ${WT}`))
  assert.match(r.text, /Branch: feat\/90-keep-my-search/)
  assert.match(r.text, /Port: 4090 /)
  assert.match(ports.fs.read(join(WT, ".env")), /^PORT=4090$/m)
  const gitDir = "/tmp/opencv/.git/worktrees/feat-90-keep-my-search"
  assert.equal(ports.fs.read(join(gitDir, "assigned-port")).trim(), "4090")
  assert.match(ports.fs.read(join(gitDir, "ocv-tools-agent")), /^agent-/)
  assert.ok(ports.effects.some((e) => e.op === "assign" && e.n === 90))
  assert.ok(
    ports.effects.some(
      (e) => e.op === "comment" && e.body.includes("ocv-tools claim")
    )
  )
  assert.ok(
    ports.effects.some(
      (e) =>
        e.op === "config" &&
        e.key === "core.hooksPath" &&
        e.value === ".githooks"
    )
  )
  assert.equal(ports.counts.issue, 1)
  assert.equal(
    ports.counts.worktrees,
    2,
    "one list places the worktree, one finds finished worktrees left on disk"
  )
  const last = r.text.split("\n").at(-1)
  assert.match(
    last,
    /^RESULT_JSON: .*opencv-new-task-feat-90-keep-my-search\.json$/
  )
  const json = JSON.parse(readFileSync(last.slice(13), "utf8"))
  assert.equal(json.status, "ok")
  assert.equal(json.script, "new-task")
  const again = run({
    worktrees: ports.state.worktrees.map((w) => ({ ...w })),
  })
  assert.match(
    runCli(["take", "90", "--no-install"], again.ctx).text,
    /REFUSED WORKTREE_EXISTS/
  )
})

test("take reconciles finished worktrees after a queued or human merge without depending on the former account", () => {
  const old = {
    path: "/tmp/opencv.worktrees/80-old-fix",
    branch: "fix/80-old-fix",
  }
  const left = run({
    dirs: [`${WT}/.githooks`],
    hooksPath: "/dev/null",
    worktrees: [old],
    prs: [pr(7, { state: "MERGED", head: "fix/80-old-fix" })],
  })
  const r = runCli(["take", "90", "--no-install"], left.ctx)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Removed:\n.*80-old-fix/)
  assert.ok(
    left.ports.effects.some(
      (e) => e.op === "removeWorktree" && e.path === old.path
    )
  )
  const none = run({
    dirs: [`${WT}/.githooks`],
    hooksPath: "/dev/null",
    worktrees: [old],
  })
  const clean = runCli(["take", "90", "--no-install"], none.ctx)
  assert.equal(clean.code, 0, clean.text)
  assert.doesNotMatch(clean.text, /Finished worktrees/)
})

test("take picks the next free port when another worktree holds the first", () => {
  const { ports, ctx } = run({
    issues: [issue(90), issue(1090, { title: "feat: Other thing here" })],
  })
  runCli(["take", "90", "--no-install"], ctx)
  const r = runCli(["take", "1090", "--no-install"], ctxFor(ports))
  assert.match(r.text, /Port: 4091 /, r.text)
})

test("take allocates no port above the shared range", () => {
  const { ctx } = run({
    issues: [issue(999)],
    listening: [WORKTREE_PORTS.last],
  })
  const r = runCli(
    ["take", "999", "--no-install", "-d", "worktree ports no collision"],
    ctx
  )
  assert.equal(r.code, 0, r.text)
  const found = /Port: (\d+) \(api on (\d+), web on (\d+)\)/.exec(r.text)
  assert.ok(found, r.text)
  const api = Number(found[1])
  const web = Number(found[3])
  const band = WORKTREE_PORTS.last - WORKTREE_PORTS.first + 1
  assert.equal(api, WORKTREE_PORTS.first)
  assert.ok(api <= WORKTREE_PORTS.last)
  assert.equal(web, api + band)
  assert.ok(web > WORKTREE_PORTS.last)
  const blocked = []
  for (let port = WORKTREE_PORTS.first; port <= WORKTREE_PORTS.last; port += 1)
    blocked.push(port)
  const full = run({ issues: [issue(999)], listening: blocked })
  assert.throws(
    () => pickPort(full.ctx, 999, full.ports.state.root),
    new RegExp(
      `no free port in ${WORKTREE_PORTS.first} to ${WORKTREE_PORTS.last}`
    )
  )
})

test("take skips a port whose web port is busy or reserved", () => {
  assert.equal(RESERVED_WEB_PORTS.has(5432), true)
  const reserved = run({ issues: [issue(432)] })
  assert.equal(pickPort(reserved.ctx, 432, reserved.ports.state.root), 4433)
  const postgres = run({ issues: [issue(432)], listening: [5432] })
  const taken = runCli(
    ["take", "432", "--no-install", "-d", "worktree ports no collision"],
    postgres.ctx
  )
  assert.equal(taken.code, 0, taken.text)
  assert.match(taken.text, /Port: 4433 \(api on 4433, web on 5433\)/)
  const busy = run({ issues: [issue(100)], listening: [5100] })
  assert.equal(pickPort(busy.ctx, 100, busy.ports.state.root), 4101)
  const root = "/tmp/opencv.worktrees"
  const claimed = run({
    files: { [`${root}/1-old/.env`]: "PORT=5200\n" },
  })
  claimed.ports.fs.mkdir(root)
  assert.equal(pickPort(claimed.ctx, 200, root), 4201)
})

test("a closed issue is refused before login or a worktree read", () => {
  const ports = fakePorts({
    issues: [issue(90, { state: "CLOSED" })],
  })
  ports.gh.login = () => {
    throw new Error("login failed")
  }
  const r = runCli(["take", "90", "--no-install"], ctxFor(ports))
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED CLOSED: #90 is closed/)
  assert.match(
    r.text,
    /Fix: The issue is closed\. Run: gh issue list, and pick another\./
  )
  assert.equal(ports.counts.worktrees, 0)
  assert.equal(ports.counts.issue, 1)
})

test("take refuses on low disk before touching gh writes, git or the worktree, and records cause disk", () => {
  const { ports, ctx } = run({ diskFreeMb: 4 })
  const r = runCli(["take", "90"], ctx)
  assert.equal(r.code, 2)
  assert.match(r.text, /REFUSED DISK: only \d+ MiB free/)
  assert.equal(ports.state.worktrees.length, 0)
  assert.deepEqual(ports.effects, [])
  assert.equal(ports.counts.issue, 1)
  const json = JSON.parse(
    readFileSync(r.text.split("\n").at(-1).slice(13), "utf8")
  )
  assert.equal(json.status, "fail")
  assert.equal(json.cause, "disk")
})

test("take --take overrides another assignee; a branch already on origin is refused", () => {
  const dup = run({
    remoteBranches: [BRANCH],
    issues: [issue(90, { assignees: ["someone"] })],
  })
  assert.match(
    runCli(["take", "90", "--take", "--no-install"], dup.ctx).text,
    /REFUSED BRANCH_EXISTS.*origin/
  )
  const ok = run({ issues: [issue(90, { assignees: ["someone"] })] })
  const r = runCli(
    ["take", "90", "--take", "--no-install", "-d", "my own words here"],
    ok.ctx
  )
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Branch: feat\/90-my-own-words-here/)
})

test("take with a title files the issue first, then takes it", () => {
  const { ports, ctx } = run({ issues: [], nextIssue: 90 })
  const r = runCli(["take", ...filed], ctx)
  assert.equal(r.code, 0, r.text)
  const ops = ports.effects.map((e) => e.op)
  assert.ok(ops.indexOf("createIssue") < ops.indexOf("comment"))
  assert.match(r.text, /Branch: feat\/90-keep-my-search/)
})

test("take with a jargon title body files, takes and prints the writing warnings", () => {
  const { ports, ctx } = run({ issues: [], nextIssue: 90 })
  const long = `The API endpoint ${Array.from({ length: 22 }, () => "word").join(" ")}.`
  const r = runCli(
    ["take", ...filed.map((a) => (a.startsWith("The page") ? long : a))],
    ctx
  )
  assert.equal(r.code, 0, r.text)
  assert.ok(ports.effects.some((e) => e.op === "createIssue"))
  assert.match(r.text, /Took #90/)
  assert.match(r.text, /Warning: .*jargon word "api"/)
  assert.match(r.text, /Warning: .*-word sentence/)
})

test("a title on low disk makes zero gh calls", () => {
  const { ports, ctx } = run({ diskFreeMb: 4 })
  const r = runCli(
    [
      "take",
      "fix: Cart total rounds wrong",
      "--what",
      "The total is wrong. This rounds it.",
      "--done",
      "- The cart shows the rounded total.",
      "--risk",
      "low",
    ],
    ctx
  )
  assert.match(r.text, /REFUSED DISK/)
  assert.equal(ports.counts.issue, 0)
  assert.deepEqual(ports.effects, [])
  assert.equal(ports.state.worktrees.length, 0)
})

test("take --resume checks out a branch that was already pushed", () => {
  const world = {
    issues: [issue(90, { comments: [claim("old", 400)] })],
    remoteBranches: [BRANCH],
  }
  const refused = run(world)
  const no = runCli(["take", "90", "--no-install"], refused.ctx)
  assert.match(
    no.text,
    /branch feat\/90-keep-my-search already exists on origin/
  )
  assert.match(no.text, /Fix: scripts\/ocv-tools\.mjs take 90 --resume/)
  const ok = run({ ...world, env: { OCV_TOOLS_AGENT: "next" } })
  const r = runCli(["take", "90", "--resume", "--no-install"], ok.ctx)
  assert.equal(r.code, 0, r.text)
  const added = ok.ports.effects.find((e) => e.op === "addWorktree")
  assert.equal(added.mode, "track")
  assert.equal(added.start, `origin/${BRANCH}`)
  assert.equal(added.branch, BRANCH)
})

test("take --resume fast-forwards a local branch that is behind origin", () => {
  const { ports, ctx } = run({
    env: { OCV_TOOLS_AGENT: "next" },
    issues: [issue(90, { comments: [claim("old", 400)] })],
    localBranches: [BRANCH],
    remoteBranches: [BRANCH],
    relation: { [BRANCH]: "behind" },
  })
  const r = runCli(["take", "90", "--resume", "--no-install"], ctx)
  assert.equal(r.code, 0, r.text)
  assert.ok(ports.effects.some((e) => e.op === "fast-forward"))
  const added = ports.effects.find((e) => e.op === "addWorktree")
  assert.equal(added.mode, "local")
})

test("take --resume refuses a local branch that diverged from origin", () => {
  const { ports, ctx } = run({
    env: { OCV_TOOLS_AGENT: "next" },
    issues: [issue(90, { comments: [claim("old", 400)] })],
    localBranches: [BRANCH],
    remoteBranches: [BRANCH],
    relation: { [BRANCH]: "diverged" },
  })
  const r = runCli(["take", "90", "--resume", "--no-install"], ctx)
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED DIVERGED/)
  assert.match(r.text, /\nFix: /)
  assert.match(r.text, /git log --oneline --left-right/)
  assert.ok(!ports.effects.some((e) => e.op === "addWorktree"))
  assert.ok(!ports.effects.some((e) => e.op === "fast-forward"))
})

test("take refuses a malformed issue title before creating a worktree", () => {
  const { ctx, ports } = run({
    issues: [issue(90, { title: "Keep my search" })],
  })
  const result = runCli(["take", "90", "--no-install"], ctx)
  assert.equal(result.code, 2, result.text)
  assert.match(result.text, /PR_METADATA/)
  assert.ok(
    !ports.effects.some((e) =>
      ["addWorktree", "comment", "push"].includes(e.op)
    )
  )
})

test("take --resume checks the existing PR closing link before creating a worktree", () => {
  const { ctx, ports } = run({
    env: { OCV_TOOLS_AGENT: "next" },
    issues: [issue(90, { comments: [claim("old", 400)] })],
    remoteBranches: [BRANCH],
    prs: [
      {
        number: 91,
        state: "OPEN",
        headRefName: BRANCH,
        title: "feat: keep my search (#90)",
        body: "Closes #89",
      },
    ],
  })
  const result = runCli(["take", "90", "--resume", "--no-install"], ctx)
  assert.equal(result.code, 2, result.text)
  assert.match(result.text, /PR_METADATA/)
  assert.ok(!ports.effects.some((e) => e.op === "addWorktree"))
})

const manifests = (entries) => {
  const files = new Map(
    Object.entries(entries).map(([dir, manifest]) => [
      `/wt/packages/${dir}/package.json`,
      typeof manifest === "string" ? manifest : JSON.stringify(manifest),
    ])
  )
  return {
    exists: (path) => path === "/wt/packages" || files.has(path),
    list: () => Object.keys(entries),
    read: (path) => files.get(path),
  }
}

test("only packages that are used from their built output and can build are built after install", () => {
  const fs = manifests({
    domain: {
      name: "@workspace/domain",
      main: "./dist/index.js",
      scripts: { build: "tsc" },
    },
    "paper-crdt": {
      name: "@workspace/paper-crdt",
      exports: { ".": { import: "./dist/index.js" } },
      scripts: { build: "tsc" },
    },
    ui: {
      name: "@workspace/ui",
      exports: { ".": "./src/index.ts" },
      scripts: { build: "tsc" },
    },
    types: { name: "@workspace/types", main: "./dist/index.js", scripts: {} },
    broken: "{",
  })
  const names = packagesUsedFromBuiltOutput(fs, "/wt")
  assert.deepEqual(names, ["@workspace/domain", "@workspace/paper-crdt"])
  assert.deepEqual(buildCommand(names), [
    "pnpm",
    [
      "--filter",
      "@workspace/domain",
      "--filter",
      "@workspace/paper-crdt",
      "build",
    ],
  ])
  const missing = {
    list: () => {
      throw new Error("ENOENT")
    },
  }
  assert.deepEqual(packagesUsedFromBuiltOutput(missing, "/wt"), [])
})

test("the real repo names exactly the packages a new task folder must build", () => {
  const root = new URL("../../", import.meta.url).pathname.replace(/\/$/, "")
  const fs = {
    exists: (path) => {
      try {
        readFileSync(path)
        return true
      } catch (error) {
        return error.code === "EISDIR"
      }
    },
    list: (dir) => readdirSync(dir),
    read: (path) => readFileSync(path, "utf8"),
  }
  assert.deepEqual(packagesUsedFromBuiltOutput(fs, root), [
    "@workspace/domain",
    "@workspace/paper-crdt",
    "@workspace/paper-engine",
  ])
})

test("take installs and then builds the packages used from built output", () => {
  const { ctx, ports } = run({
    files: {
      [`${WT}/package.json`]: "{}",
      [`${WT}/pnpm-lock.yaml`]: "",
      [`${WT}/packages/domain/package.json`]: JSON.stringify({
        name: "@workspace/domain",
        main: "./dist/index.js",
        scripts: { build: "tsc" },
      }),
    },
  })
  const r = runCli(["take", "90"], ctx)
  assert.equal(r.code, 0, r.text)
  const ran = ports.effects
    .filter((e) => e.op === "proc" && e.cmd === "pnpm")
    .map((e) => e.args.join(" "))
  assert.deepEqual(ran, [
    "install --frozen-lockfile",
    "--filter @workspace/domain build",
  ])
})
