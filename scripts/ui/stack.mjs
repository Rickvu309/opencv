import { basename, join } from "node:path"
import { WORKTREE_PORTS } from "../../packages/domain/src/local-ports.ts"
import { resolveApiPort, verifierPorts } from "../lib/worktree-port.mjs"
import { poolPaths } from "./account-pool.mjs"

export const ACCOUNT = { email: "ui-agent@example.com" }
const START_DEADLINE_MS = 180_000
const BUILD_DEADLINE_MS = 300_000
const DOMAIN_BUILD = join("packages", "domain", "dist", "kernel", "public.js")
const STOP_DEADLINE_MS = 10_000
const SEED_DEADLINE_MS = 120_000
export const SEEDED_ACCOUNTS = 120
export const SEED_SESSIONS = join("src", "test", "seed-sessions.ts")

export function seededPaths(dir) {
  const root = join(dir, "seeded")
  return {
    root,
    ready: join(root, "ready"),
    taken: join(root, "taken"),
    used: join(root, "used"),
  }
}

async function seedAccounts(ctx, { dir, env, count }) {
  const paths = seededPaths(dir)
  const log = join(dir, "seed.log")
  const code = await ctx.proc.run(
    "pnpm",
    [
      "--dir",
      "apps/api",
      "exec",
      "tsx",
      "--conditions=opencv-source",
      SEED_SESSIONS,
      env.PGLITE_DATA_DIR,
      String(count),
      paths.ready,
    ],
    { cwd: ctx.repo, env, log, timeoutMs: SEED_DEADLINE_MS }
  )
  if (code !== 0)
    throw new Error(`seeding ${count} signed-in accounts failed (log ${log})`)
  return { count, dir: paths.root }
}

export const LOCKFILE = "pnpm-lock.yaml"
export const INSTALLED_LOCKFILE = join("node_modules", ".pnpm", "lock.yaml")

export function installDrift({ lockfile, installed }) {
  if (installed === lockfile) return null
  return installed
    ? "the installed packages come from an older pnpm-lock.yaml"
    : "the packages are not installed"
}

function refuseStaleInstall(ctx) {
  const drift = installDrift({
    lockfile: ctx.fs.readOptional(join(ctx.repo, LOCKFILE)),
    installed: ctx.fs.readOptional(join(ctx.repo, INSTALLED_LOCKFILE)),
  })
  if (drift)
    throw new Error(
      `${drift}, so the web server cannot load new packages and screens fail for the wrong reason. Run: pnpm --dir ${ctx.repo} install --frozen-lockfile, then node scripts/ui.mjs down and up`
    )
}

export function stateDir(scratchRoot, repo) {
  return join(scratchRoot, basename(repo))
}

export function portCandidates(preferred) {
  const range = []
  for (let port = WORKTREE_PORTS.first; port <= WORKTREE_PORTS.last; port += 1)
    if (port !== preferred) range.push(port)
  return [preferred, ...range].filter((port) => port && verifierPorts(port))
}

export function stackEnv({ base, ports, dir, name }) {
  const shared = {
    ...base,
    NODE_ENV: "development",
    PORT: String(ports.apiPort),
  }
  return {
    api: {
      ...shared,
      DB_DRIVER: "pglite",
      PGLITE_DATA_DIR: join(dir, "pglite"),
      COACH_RUNTIME: "fake",
      OPENCV_VERIFY_RUN: name,
      AUTH_URL: ports.apiOrigin,
      WEB_ORIGINS: ports.webOrigin,
      SESSION_SECRET: `ocv-ui-local-session-secret-${name}-0123456789abcdef`,
      MAIL_PROVIDER: "fake",
    },
    web: { ...shared, VITE_API_URL: ports.apiOrigin },
  }
}

export function lastSignInCode(logText, email) {
  const pattern = /\[auth\] email code for (\S+) type sign-in: (\d{6})/g
  let code = null
  for (const match of String(logText).matchAll(pattern))
    if (match[1] === email.toLowerCase()) code = match[2]
  return code
}

export function cookiesFromSetCookie(headers, domain) {
  return headers.map((header) => {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim())
    const split = pair.indexOf("=")
    const flags = new Map(
      attributes.map((attribute) => {
        const [key, value] = attribute.split("=")
        return [key.toLowerCase(), value ?? true]
      })
    )
    const sameSite = String(flags.get("samesite") ?? "Lax")
    return {
      name: pair.slice(0, split),
      value: pair.slice(split + 1),
      domain,
      path: String(flags.get("path") ?? "/"),
      expires: -1,
      httpOnly: flags.has("httponly"),
      secure: flags.has("secure"),
      sameSite: sameSite[0].toUpperCase() + sameSite.slice(1).toLowerCase(),
    }
  })
}

async function waitUntil(ctx, check, deadlineMs, what) {
  const until = ctx.clock.now() + deadlineMs
  while (ctx.clock.now() < until) {
    if (await check()) return
    await ctx.clock.pause(500)
  }
  throw new Error(`${what} did not become ready within ${deadlineMs / 1000}s`)
}

const healthy = async (ctx, url) => {
  try {
    return (await ctx.http.get(url)).status === 200
  } catch {
    return false
  }
}

export function readState(ctx) {
  const file = join(stateDir(ctx.scratchRoot, ctx.repo), "state.json")
  if (!ctx.fs.exists(file)) return null
  try {
    return JSON.parse(ctx.fs.read(file))
  } catch {
    return null
  }
}

export async function liveState(ctx) {
  const state = readState(ctx)
  if (!state) return null
  const alive = state.pids.every((pid) => ctx.proc.alive(pid))
  if (!alive) return null
  const ready =
    (await healthy(ctx, `${state.apiOrigin}/health`)) &&
    (await healthy(ctx, `${state.webOrigin}/`))
  return ready ? state : null
}

async function stopPids(ctx, pids) {
  for (const pid of pids) ctx.proc.stop(pid, "SIGTERM")
  const until = ctx.clock.now() + STOP_DEADLINE_MS
  while (ctx.clock.now() < until && pids.some((pid) => ctx.proc.alive(pid)))
    await ctx.clock.pause(250)
  for (const pid of pids) if (ctx.proc.alive(pid)) ctx.proc.stop(pid, "SIGKILL")
}

export const portClaimFile = (scratchRoot, apiPort) =>
  join(scratchRoot, "ports", `${apiPort}.json`)

function claimOwnerAlive(ctx, file) {
  try {
    const owner = JSON.parse(ctx.fs.read(file))
    return owner.pids.some((pid) => ctx.proc.alive(pid))
  } catch {
    return false
  }
}

export function claimPort(ctx, apiPort, dir) {
  const file = portClaimFile(ctx.scratchRoot, apiPort)
  const owner = JSON.stringify({ pids: [ctx.pid], dir })
  if (ctx.fs.claim(file, owner)) return true
  if (claimOwnerAlive(ctx, file)) return false
  ctx.fs.remove(file)
  return ctx.fs.claim(file, owner)
}

function releasePort(ctx, state) {
  const file = portClaimFile(ctx.scratchRoot, state.apiPort)
  try {
    if (JSON.parse(ctx.fs.read(file)).dir === state.dir) ctx.fs.remove(file)
  } catch {
    return
  }
}

async function choosePorts(ctx, requested, dir) {
  const preferred =
    requested ??
    resolveApiPort({
      envPort: ctx.env.PORT,
      envText: ctx.fs.readOptional(join(ctx.repo, ".env")),
    })
  for (const apiPort of portCandidates(preferred)) {
    const ports = verifierPorts(apiPort)
    if (
      (await ctx.net.isFree(ports.apiPort)) &&
      (await ctx.net.isFree(ports.webPort)) &&
      claimPort(ctx, apiPort, dir)
    )
      return ports
    if (requested)
      throw new Error(`port ${apiPort} or ${ports.webPort} is in use`)
  }
  throw new Error("no free api and web port pair in the worktree range")
}

async function signIn(ctx, ports, apiLog) {
  const headers = {
    "content-type": "application/json",
    origin: ports.webOrigin,
  }
  const sent = await ctx.http.post(
    `${ports.apiOrigin}/api/auth/email-otp/send-verification-otp`,
    { email: ACCOUNT.email, type: "sign-in" },
    headers
  )
  if (sent.status !== 200)
    throw new Error(`sign-in code request failed with ${sent.status}`)
  let code = null
  await waitUntil(
    ctx,
    () =>
      Boolean(
        (code = lastSignInCode(ctx.fs.readOptional(apiLog), ACCOUNT.email))
      ),
    15_000,
    "the sign-in code in the api log"
  )
  const signed = await ctx.http.post(
    `${ports.apiOrigin}/api/auth/sign-in/email-otp`,
    { email: ACCOUNT.email, otp: code },
    headers
  )
  if (signed.status !== 200)
    throw new Error(`sign-in failed with ${signed.status}`)
  return cookiesFromSetCookie(signed.setCookie, "localhost")
}

const FILLER = join("scripts", "ui", "account-filler.mjs")

function startFiller(ctx, state) {
  const paths = poolPaths(state.dir)
  ctx.fs.mkdir(paths.root)
  const pid = ctx.proc.start("node", [join(ctx.repo, FILLER), state.dir], {
    cwd: ctx.repo,
    env: ctx.env,
    log: paths.log,
  })
  const next = { ...state, pool: { pid, dir: paths.root } }
  ctx.fs.write(join(state.dir, "state.json"), JSON.stringify(next, null, 2))
  return next
}

export async function up(ctx, { port } = {}) {
  refuseStaleInstall(ctx)
  const running = await liveState(ctx)
  if (running) {
    const filling = running.pool && ctx.proc.alive(running.pool.pid)
    return {
      reused: true,
      state: filling ? running : startFiller(ctx, running),
    }
  }
  const dir = stateDir(ctx.scratchRoot, ctx.repo)
  const stale = readState(ctx)
  if (stale)
    await stopPids(ctx, [...stale.pids, stale.pool?.pid].filter(Boolean))
  ctx.fs.remove(join(dir, "pglite"))
  ctx.fs.remove(poolPaths(dir).root)
  ctx.fs.remove(seededPaths(dir).root)
  ctx.fs.mkdir(dir)
  const name = basename(ctx.repo)
  const ports = await choosePorts(ctx, port, dir)
  const env = stackEnv({ base: ctx.env, ports, dir, name })
  const apiLog = join(dir, "api.log")
  const webLog = join(dir, "web.log")
  ctx.fs.write(apiLog, "")
  ctx.fs.write(webLog, "")
  if (!ctx.fs.exists(join(ctx.repo, DOMAIN_BUILD))) {
    const buildLog = join(dir, "build.log")
    const built = await ctx.proc.run(
      "pnpm",
      ["--filter", "@workspace/domain", "build"],
      {
        cwd: ctx.repo,
        env: ctx.env,
        log: buildLog,
        timeoutMs: BUILD_DEADLINE_MS,
      }
    )
    if (built !== 0)
      throw new Error(`the domain package build failed (log ${buildLog})`)
  }
  const seeded = await seedAccounts(ctx, {
    dir,
    env: env.api,
    count: SEEDED_ACCOUNTS,
  })
  const apiPid = ctx.proc.start(
    "pnpm",
    [
      "--dir",
      "apps/api",
      "exec",
      "tsx",
      "--conditions=opencv-source",
      "src/index.ts",
    ],
    { cwd: ctx.repo, env: env.api, log: apiLog }
  )
  const webPid = ctx.proc.start(
    "pnpm",
    [
      "--dir",
      "apps/web",
      "exec",
      "vite",
      "--port",
      String(ports.webPort),
      "--strictPort",
    ],
    { cwd: ctx.repo, env: env.web, log: webLog }
  )
  const state = {
    name,
    repo: ctx.repo,
    dir,
    pids: [apiPid, webPid],
    ...ports,
    email: ACCOUNT.email,
    seeded,
    storage: join(dir, "storage.json"),
    logs: { api: apiLog, web: webLog },
  }
  ctx.fs.write(join(dir, "state.json"), JSON.stringify(state, null, 2))
  ctx.fs.write(
    portClaimFile(ctx.scratchRoot, ports.apiPort),
    JSON.stringify({ pids: state.pids, dir })
  )
  await waitUntil(
    ctx,
    () => healthy(ctx, `${ports.apiOrigin}/health`),
    START_DEADLINE_MS,
    `api (log ${apiLog})`
  )
  await waitUntil(
    ctx,
    () => healthy(ctx, `${ports.webOrigin}/`),
    START_DEADLINE_MS,
    `web (log ${webLog})`
  )
  const cookies = await signIn(ctx, ports, apiLog)
  ctx.fs.write(state.storage, JSON.stringify({ cookies, origins: [] }, null, 2))
  return { reused: false, state: startFiller(ctx, state) }
}

export async function serveProductionWeb(ctx) {
  const state = await liveState(ctx)
  if (!state)
    throw new Error(
      "no running app for this worktree: run node scripts/ui.mjs up"
    )
  if (state.webBuild === "production") return state
  const out = join(state.dir, "web-production")
  const log = join(state.dir, "web-production.log")
  ctx.fs.write(log, "")
  const env = {
    ...ctx.env,
    VITE_API_URL: state.apiOrigin,
    PORT: String(state.apiPort),
  }
  const built = await ctx.proc.run(
    "pnpm",
    [
      "--dir",
      "apps/web",
      "exec",
      "vite",
      "build",
      "--outDir",
      out,
      "--emptyOutDir",
    ],
    { cwd: ctx.repo, env, log, timeoutMs: BUILD_DEADLINE_MS }
  )
  if (built !== 0)
    throw new Error(`the production web build failed (log ${log})`)
  const [apiPid, devPid] = state.pids
  await stopPids(ctx, [devPid])
  const webPid = ctx.proc.start(
    "pnpm",
    [
      "--dir",
      "apps/web",
      "exec",
      "vite",
      "preview",
      "--outDir",
      out,
      "--port",
      String(state.webPort),
      "--strictPort",
    ],
    { cwd: ctx.repo, env, log }
  )
  const next = { ...state, pids: [apiPid, webPid], webBuild: "production" }
  ctx.fs.write(join(state.dir, "state.json"), JSON.stringify(next, null, 2))
  ctx.fs.write(
    portClaimFile(ctx.scratchRoot, state.apiPort),
    JSON.stringify({ pids: next.pids, dir: state.dir })
  )
  await waitUntil(
    ctx,
    () => healthy(ctx, `${state.webOrigin}/`),
    START_DEADLINE_MS,
    `production web (log ${log})`
  )
  return next
}

export async function down(ctx) {
  const state = readState(ctx)
  if (!state) return { stopped: [] }
  await stopPids(ctx, [...state.pids, state.pool?.pid].filter(Boolean))
  ctx.fs.remove(join(state.dir, "pglite"))
  ctx.fs.remove(poolPaths(state.dir).root)
  ctx.fs.remove(seededPaths(state.dir).root)
  ctx.fs.remove(join(state.dir, "state.json"))
  ctx.fs.remove(state.storage)
  releasePort(ctx, state)
  return { stopped: state.pids, dir: state.dir }
}
