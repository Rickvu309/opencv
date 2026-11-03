import { spawn } from "node:child_process"
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  startStack,
  stopStack,
} from "../.claude/skills/verify-app-ui/scripts/lib/stack.mjs"
import {
  PENDING_EXTRAS,
  pendingExtraProblems,
} from "../.claude/skills/verify-app-ui/scripts/lib/pen-layout-compare.mjs"
import {
  RUNS_FILE,
  judge,
  parsePenLayout,
  runProblems,
} from "./lib/ci-screens.mjs"
import { verifierPorts } from "./lib/worktree-port.mjs"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const scripts = join(root, ".claude/skills/verify-app-ui/scripts")
const out = resolve(
  process.env.CI_SCREENS_OUT ?? join(homedir(), "tmp", "ci-screens")
)
const skips = JSON.parse(
  readFileSync(join(root, "scripts/ci-screens.skips.json"), "utf8")
)
const RUNS = JSON.parse(readFileSync(join(root, RUNS_FILE), "utf8"))
const tableProblems = runProblems(RUNS, (script) =>
  existsSync(join(scripts, script))
)
if (tableProblems.length) {
  for (const problem of tableProblems) console.error(problem)
  process.exit(1)
}
const budgetMs = Number(process.env.CI_SCREENS_BUDGET_MS ?? 11 * 60 * 1000)
const startedAt = Date.now()
const SHARED_RUN = "ci-screens"
const sharedPorts = verifierPorts(4460)
if (!sharedPorts) {
  console.error(
    "ci-screens error: the shared api port is outside the worktree range"
  )
  process.exit(1)
}
const SHARED = {
  apiPort: sharedPorts.apiPort,
  webPort: sharedPorts.webPort,
}

mkdirSync(out, { recursive: true })

function run(id, args, { env = {}, timeoutMs, stackRun }) {
  return new Promise((done) => {
    const log = createWriteStream(join(out, `${id.replace(/:/g, "-")}.log`))
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ...env },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    let timedOut = false
    const collect = (chunk) => {
      output += chunk
      log.write(chunk)
    }
    child.stdout.on("data", collect)
    child.stderr.on("data", collect)
    const timer = setTimeout(() => {
      timedOut = true
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {}
      if (stackRun) stopStack(`${stackRun}-${child.pid}`)
    }, timeoutMs)
    child.on("close", (code) => {
      clearTimeout(timer)
      log.end()
      done({ code: timedOut ? "timeout" : code, output })
    })
  })
}

function remaining(limitMs) {
  return Math.max(1000, Math.min(limitMs, budgetMs - (Date.now() - startedAt)))
}

const results = []
const record = (result) => {
  results.push(result)
  console.log(
    `${result.status.toUpperCase()} ${result.id} ${result.detail ?? ""}`
  )
}

async function runOwnStack(driver) {
  const args = [join(scripts, driver.script), ...(driver.extra ?? [])]
  const result = await run(driver.id, args, {
    env: {
      PORT: String(driver.port),
      [driver.shotsEnv]: join(out, driver.id),
    },
    stackRun: driver.id,
    timeoutMs: remaining(driver.timeoutMinutes * 60 * 1000),
  })
  if (driver.verdict === "exit") {
    record({
      id: driver.id,
      status: result.code === 0 ? "pass" : result.code === 1 ? "fail" : "error",
      detail: `exit ${result.code}`,
    })
    return
  }
  const frames = parsePenLayout(result.output)
  if (!frames.length) {
    record({ id: driver.id, status: "error", detail: `exit ${result.code}` })
  } else {
    frames.forEach(record)
  }
}

async function runSelfLaunching() {
  for (const driver of RUNS.filter((entry) => entry.stack === "own"))
    await runOwnStack(driver)
}

async function runExternal() {
  const stack = startStack({ ...SHARED, run: SHARED_RUN })
  const env = {
    PORT: String(SHARED.apiPort),
    WEB_ORIGIN: stack.webUrl,
    VERIFY_API_LOG: stack.logPath,
    WEB_URL: stack.webUrl,
    API_URL: stack.apiUrl,
    API_LOG: stack.logPath,
  }
  for (const driver of RUNS.filter((entry) => entry.stack === "shared")) {
    const evidence = join(out, driver.id)
    mkdirSync(evidence, { recursive: true })
    const result = await run(
      driver.id,
      [join(scripts, driver.script), evidence, ...(driver.extra ?? [])],
      { env, timeoutMs: remaining(2.5 * 60 * 1000) }
    )
    record({
      id: driver.id,
      status: result.code === 0 ? "pass" : "fail",
      detail: `exit ${result.code}`,
    })
  }
}

let crashed = null
try {
  await runSelfLaunching()
  await runExternal()
} catch (error) {
  crashed = error
  console.error(`ci-screens error: ${error.message}`)
} finally {
  stopStack(SHARED_RUN)
  const stackLogs = join(homedir(), "tmp", "verify-app-ui", "stack")
  if (existsSync(stackLogs)) {
    for (const name of readdirSync(stackLogs)) {
      const dir = join(stackLogs, name)
      if (statSync(dir).mtimeMs >= startedAt)
        cpSync(dir, join(out, "stack", name), { recursive: true })
    }
  }
}

const today = new Date().toISOString().slice(0, 10)
const verdict = judge({ results, skips, today })
const pendingProblems = pendingExtraProblems({
  entries: PENDING_EXTRAS,
  frameIds: JSON.parse(
    readFileSync(join(root, "apps/web/src/test/design-frames.json"), "utf8")
  ).frames.map((frame) => frame.id),
  today,
})
console.log("\n==== screen layout checks ====")
for (const line of verdict.lines) console.log(line)
for (const problem of pendingProblems)
  console.log(`FAIL pending extra ${problem}`)
const skipped = verdict.lines.filter((line) => line.startsWith("SKIPPED"))
if (skipped.length)
  console.log(
    `\n!!!! ${skipped.length} SCREENS ARE SKIPPED AND FAIL ON MAIN. They are not checked. See scripts/ci-screens.skips.json !!!!`
  )
const seconds = Math.round((Date.now() - startedAt) / 1000)
console.log(
  `${verdict.failed || crashed || pendingProblems.length ? "FAILED" : "OK"} in ${seconds}s, ${results.length} results, ${skipped.length} skipped`
)
process.exit(verdict.failed || crashed || pendingProblems.length ? 1 : 0)
