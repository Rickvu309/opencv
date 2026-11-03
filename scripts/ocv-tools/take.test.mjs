import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { WORKTREE_PORTS } from "../../packages/domain/src/local-ports.ts"
import { runCli } from "./cli.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { ctxFor, fakePorts, issue, minutesAgo, pr } from "./ports/fake.mjs"
import { RESERVED_WEB_PORTS, pickPort, slugify } from "./worktree.mjs"

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

test("take builds the branch, worktree, .env, port record, claim and result", () => {
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
  assert.equal(ports.counts.issue, 3)
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

test("take lists finished worktrees a human merge left on disk, and nothing when there are none", () => {
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
  assert.match(
    r.text,
    /Finished worktrees still on disk \(their pull requests merged\): \/tmp\/opencv\.worktrees\/80-old-fix \(fix\/80-old-fix\)\. Run: scripts\/ocv-tools\.mjs cleanup --all/
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

test("take --resume checks out a branch an idle holder already pushed", () => {
  const world = {
    issues: [issue(90, { comments: [claim("old", 400)] })],
    remoteBranches: [BRANCH],
  }
  const refused = run(world)
  const no = runCli(["take", "90", "--no-install"], refused.ctx)
  assert.match(
    no.text,
    /the idle holder old already pushed branch feat\/90-keep-my-search/
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

test("after install, a live claim from someone else is HELD and the worktree is removed", () => {
  const { ports, ctx } = run({
    env: { OCV_TOOLS_AGENT: "me" },
    onIssue(_n, count, found) {
      if (count >= 2 && found) found.comments.push(claim("other", 1, 2))
    },
  })
  const r = runCli(["take", "90", "--no-install"], ctx)
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED HELD: #90 is held by other/)
  assert.match(r.text, /\nFix: /)
  assert.ok(!ports.effects.some((e) => e.op === "comment"))
  assert.equal(ports.state.worktrees.length, 0)
  assert.equal(ports.counts.issue, 2)
})

test("two clients: the later claim wins and the loser removes its worktree", () => {
  let armed = true
  const ports = fakePorts({
    env: { OCV_TOOLS_AGENT: "alpha" },
    onComment(_n, body, item) {
      if (!armed || !String(body).includes("agent=alpha")) return
      armed = false
      item.comments.push(claim("beta", 0, 50))
    },
  })
  const loser = runCli(["take", "90", "--no-install"], ctxFor(ports))
  assert.equal(loser.code, 3, loser.text)
  assert.match(loser.text, /LOST #90: beta holds the claim now/)
  assert.match(loser.text, /\nFix: /)
  assert.equal(ports.state.worktrees.length, 0)
  ports.env.OCV_TOOLS_AGENT = "beta"
  const winner = runCli(["take", "90", "--no-install"], ctxFor(ports))
  assert.equal(winner.code, 0, winner.text)
  assert.match(winner.text, /Agent: beta/)
  assert.equal(ports.state.worktrees.length, 1)
})
