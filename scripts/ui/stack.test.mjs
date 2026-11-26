import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { WORKTREE_PORTS } from "../../packages/domain/src/local-ports.ts"
import { fakePorts } from "./fake-ports.mjs"
import {
  SEEDED_ACCOUNTS,
  cookiesFromSetCookie,
  down,
  lastSignInCode,
  portCandidates,
  stackEnv,
  stateDir,
  up,
} from "./stack.mjs"

const PORTS = {
  apiPort: 4333,
  webPort: 5333,
  apiOrigin: "http://localhost:4333",
  webOrigin: "http://localhost:5333",
}

test("the app runs on pglite with the fake Coach, Word pages on and no real database", () => {
  const env = stackEnv({
    base: { DATABASE_URL: "postgres://real", HOME: "/h" },
    ports: PORTS,
    dir: "/s/1-demo",
    name: "1-demo",
  })
  assert.equal(env.api.DB_DRIVER, "pglite")
  assert.equal(env.api.PGLITE_DATA_DIR, "/s/1-demo/pglite")
  assert.equal(env.api.COACH_RUNTIME, "fake")
  assert.equal(env.api.PAPER_PACKAGE_ENABLED, undefined)
  assert.equal(env.api.AUTH_URL, PORTS.apiOrigin)
  assert.equal(env.api.WEB_ORIGINS, PORTS.webOrigin)
  assert.equal(env.web.VITE_API_URL, PORTS.apiOrigin)
  assert.equal(env.web.PORT, "4333")
})

test("the sign-in code is the last one logged for the account", () => {
  const log = [
    "[auth] email code for other@example.com type sign-in: 111111",
    "[auth] email code for ui-agent@example.com type sign-in: 222222",
    "[auth] email code for ui-agent@example.com type sign-in: 333333",
  ].join("\n")
  assert.equal(lastSignInCode(log, "UI-agent@example.com"), "333333")
  assert.equal(lastSignInCode("api listening", "ui-agent@example.com"), null)
})

test("set-cookie headers become browser cookies for localhost", () => {
  const [cookie] = cookiesFromSetCookie(
    ["opencv.session_token=abc.def=; Path=/; HttpOnly; SameSite=lax"],
    "localhost"
  )
  assert.deepEqual(cookie, {
    name: "opencv.session_token",
    value: "abc.def=",
    domain: "localhost",
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  })
})

test("ports try the preferred worktree port first and stay in the worktree range", () => {
  const candidates = portCandidates(4333)
  assert.equal(candidates[0], 4333)
  assert.equal(new Set(candidates).size, candidates.length)
  assert.ok(
    candidates.every(
      (port) => port >= WORKTREE_PORTS.first && port <= WORKTREE_PORTS.last
    )
  )
  assert.equal(portCandidates(undefined)[0], WORKTREE_PORTS.first)
})

test("a second up reuses the running app and starts nothing", async () => {
  const dir = stateDir("/scratch/ocv-ui", "/work/opencv.worktrees/1-demo")
  const state = {
    dir,
    pids: [7, 8],
    apiOrigin: PORTS.apiOrigin,
    webOrigin: PORTS.webOrigin,
    storage: `${dir}/storage.json`,
    pool: { pid: 9, dir: `${dir}/pool` },
  }
  const ctx = fakePorts({
    files: { [`${dir}/state.json`]: JSON.stringify(state) },
    alive: [7, 8, 9],
    healthy: [PORTS.apiOrigin, PORTS.webOrigin],
  })
  const result = await up(ctx)
  assert.equal(result.reused, true)
  assert.deepEqual(ctx.started, [])
})

test("a reused app whose account pool filler stopped gets only a new filler", async () => {
  const dir = stateDir("/scratch/ocv-ui", "/work/opencv.worktrees/1-demo")
  const state = {
    dir,
    pids: [7, 8],
    apiOrigin: PORTS.apiOrigin,
    webOrigin: PORTS.webOrigin,
    pool: { pid: 9, dir: `${dir}/pool` },
  }
  const ctx = fakePorts({
    files: { [`${dir}/state.json`]: JSON.stringify(state) },
    alive: [7, 8],
    healthy: [PORTS.apiOrigin, PORTS.webOrigin],
  })
  const result = await up(ctx)
  assert.equal(ctx.started.length, 1)
  assert.equal(ctx.started[0].command, "node")
  assert.match(ctx.started[0].args[0], /scripts\/ui\/account-filler\.mjs$/)
  assert.deepEqual(ctx.started[0].args[1], dir)
  assert.equal(result.state.pool.pid, ctx.started[0].pid)
  assert.equal(
    JSON.parse(ctx.store.get(`${dir}/state.json`)).pool.pid,
    ctx.started[0].pid
  )
})

test("down stops what up started and removes its database and session", async () => {
  const dir = stateDir("/scratch/ocv-ui", "/work/opencv.worktrees/1-demo")
  const ctx = fakePorts({
    files: {
      [`${dir}/state.json`]: JSON.stringify({
        dir,
        pids: [7, 8],
        storage: `${dir}/storage.json`,
        pool: { pid: 9, dir: `${dir}/pool` },
      }),
      [`${dir}/storage.json`]: "{}",
      [`${dir}/pglite/base`]: "x",
      [`${dir}/pool/ready/00001.json`]: "{}",
      [`${dir}/pool/used/ui-pool-00002@example.com`]: "paper-home",
      [`${dir}/seeded/ready/00002.json`]: "{}",
      [`${dir}/seeded/used/ui-seed-00001@example.com`]: "paper-home",
      [`${dir}/api.log`]: "kept",
    },
    alive: [7, 8, 9],
  })
  const result = await down(ctx)
  assert.deepEqual(result.stopped, [7, 8])
  assert.deepEqual(
    ctx.stopped.map((entry) => entry.pid),
    [7, 8, 9]
  )
  assert.deepEqual([...ctx.store.keys()], [`${dir}/api.log`])
  assert.deepEqual((await down(ctx)).stopped, [])
})

test("an up that finds a dead app starts api and web on fresh state", async () => {
  const dir = stateDir("/scratch/ocv-ui", "/work/opencv.worktrees/1-demo")
  const ctx = fakePorts({
    files: {
      [`${dir}/state.json`]: JSON.stringify({ dir, pids: [7], storage: "x" }),
      [`${dir}/pglite/old`]: "x",
    },
    env: { PORT: "4333" },
  })
  await assert.rejects(up(ctx), /api \(log .*api\.log\) did not become ready/)
  assert.deepEqual(
    ctx.started.map((entry) => [entry.pid === null, entry.args.at(5)]),
    [
      [true, undefined],
      [true, "src/test/seed-sessions.ts"],
      [false, "src/index.ts"],
      [false, "5333"],
    ]
  )
  const seed = ctx.started[1]
  assert.deepEqual(seed.args.slice(6), [
    `${dir}/pglite`,
    String(SEEDED_ACCOUNTS),
    `${dir}/seeded/ready`,
  ])
  assert.equal(seed.options.env.PGLITE_DATA_DIR, `${dir}/pglite`)
  assert.equal(seed.options.env.AUTH_URL, "http://localhost:4333")
  assert.equal(seed.options.env.WEB_ORIGINS, "http://localhost:5333")
  assert.equal(ctx.started[2].options.env.PORT, "4333")
  assert.equal(ctx.store.has(`${dir}/pglite/old`), false)
  assert.deepEqual(JSON.parse(ctx.store.get(`${dir}/state.json`)).seeded, {
    count: SEEDED_ACCOUNTS,
    dir: `${dir}/seeded`,
  })
})

test("seeded accounts are made before the api opens the database, and an up whose seeding fails starts no api", async () => {
  const dir = stateDir("/scratch/ocv-ui", "/work/opencv.worktrees/1-demo")
  const ctx = fakePorts({
    files: {
      [`${dir}/seeded/ready/00001.json`]: "{}",
      [`${dir}/seeded/used/ui-seed-00009@example.com`]: "old",
    },
    env: { PORT: "4333" },
  })
  ctx.fs.write(
    "/work/opencv.worktrees/1-demo/packages/domain/dist/kernel/public.js",
    ""
  )
  ctx.proc.run = async (command, args, options) => {
    ctx.started.push({ command, args, options, pid: null })
    return 1
  }
  await assert.rejects(
    up(ctx),
    /seeding 120 signed-in accounts failed \(log .*seed\.log\)/
  )
  assert.deepEqual(
    ctx.started.map((entry) => entry.args.at(5)),
    ["src/test/seed-sessions.ts"]
  )
  assert.deepEqual(
    [...ctx.store.keys()].filter((key) => key.includes("/seeded/")),
    []
  )
})

const LOCKFILE = "pnpm-lock.yaml"
const INSTALLED_LOCKFILE = "node_modules/.pnpm/lock.yaml"

const STAGESHOW_JOINED = "bed65ced10e911037a5053239fc1ca700ac40beb"

const lockfileAt = (rev) =>
  execFileSync("git", ["show", `${rev}:${LOCKFILE}`], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })

const REPO = "/work/opencv.worktrees/1-demo"

function installedFrom({ lockfile, installed }) {
  const files = { [`${REPO}/${LOCKFILE}`]: lockfile }
  if (installed !== null) files[`${REPO}/${INSTALLED_LOCKFILE}`] = installed
  return fakePorts({ files, env: { PORT: "4333" } })
}

test("a checkout installed before stageshow joined refuses to start and names the install command", async () => {
  const lockfile = lockfileAt(STAGESHOW_JOINED)
  const installed = lockfileAt(`${STAGESHOW_JOINED}^`)
  assert.match(lockfile, /@workspace\/stageshow/)
  assert.doesNotMatch(installed, /@workspace\/stageshow/)
  const ctx = installedFrom({ lockfile, installed })
  await assert.rejects(
    up(ctx),
    /the installed packages come from an older pnpm-lock\.yaml.*Run: pnpm --dir \/work\/opencv\.worktrees\/1-demo install --frozen-lockfile/
  )
  assert.deepEqual(ctx.started, [])
})

test("a checkout with no installed packages refuses to start", async () => {
  const ctx = installedFrom({
    lockfile: "lockfileVersion: '9.0'",
    installed: null,
  })
  await assert.rejects(up(ctx), /the packages are not installed/)
  assert.deepEqual(ctx.started, [])
})

test("a checkout installed from its own lockfile starts the app", async () => {
  const lockfile = lockfileAt(STAGESHOW_JOINED)
  const ctx = installedFrom({ lockfile, installed: lockfile })
  await assert.rejects(up(ctx), /api \(log .*api\.log\) did not become ready/)
  assert.equal(
    ctx.started.some((entry) => entry.args.includes("src/index.ts")),
    true
  )
})
