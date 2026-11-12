import assert from "node:assert/strict"
import test from "node:test"
import { WORKTREE_PORTS } from "../../packages/domain/src/local-ports.ts"
import { fakePorts } from "./fake-ports.mjs"
import {
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
  }
  const ctx = fakePorts({
    files: { [`${dir}/state.json`]: JSON.stringify(state) },
    alive: [7, 8],
    healthy: [PORTS.apiOrigin, PORTS.webOrigin],
  })
  const result = await up(ctx)
  assert.equal(result.reused, true)
  assert.deepEqual(ctx.started, [])
})

test("down stops what up started and removes its database and session", async () => {
  const dir = stateDir("/scratch/ocv-ui", "/work/opencv.worktrees/1-demo")
  const ctx = fakePorts({
    files: {
      [`${dir}/state.json`]: JSON.stringify({
        dir,
        pids: [7, 8],
        storage: `${dir}/storage.json`,
      }),
      [`${dir}/storage.json`]: "{}",
      [`${dir}/pglite/base`]: "x",
      [`${dir}/api.log`]: "kept",
    },
    alive: [7, 8],
  })
  const result = await down(ctx)
  assert.deepEqual(result.stopped, [7, 8])
  assert.deepEqual(
    ctx.stopped.map((entry) => entry.pid),
    [7, 8]
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
    ctx.started.map((entry) => entry.args.slice(0, 3)),
    [
      ["--filter", "@workspace/domain", "build"],
      ["--dir", "apps/api", "exec"],
      ["--dir", "apps/web", "exec"],
    ]
  )
  assert.equal(ctx.started[1].options.env.PORT, "4333")
  assert.equal(ctx.store.has(`${dir}/pglite/old`), false)
})
