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
import { judge, parsePenLayout } from "./lib/ci-screens.mjs"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const scripts = join(root, ".claude/skills/verify-app-ui/scripts")
const out = resolve(
  process.env.CI_SCREENS_OUT ?? join(homedir(), "tmp", "ci-screens")
)
const skips = JSON.parse(
  readFileSync(join(root, "scripts/ci-screens.skips.json"), "utf8")
)
const budgetMs = Number(process.env.CI_SCREENS_BUDGET_MS ?? 11 * 60 * 1000)
const startedAt = Date.now()
const SHARED_RUN = "ci-screens"
const SHARED = { apiPort: 4460, webPort: 4461 }

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

async function runSelfLaunching() {
  const penLayout = await run(
    "pen-layout",
    [join(scripts, "verify-pen-layout.mjs")],
    {
      env: { PORT: "4450", VERIFY_PEN_LAYOUT_SHOTS: join(out, "pen-layout") },
      stackRun: "pen-layout",
      timeoutMs: remaining(4 * 60 * 1000),
    }
  )
  const frames = parsePenLayout(penLayout.output)
  if (!frames.length) {
    record({
      id: "pen-layout",
      status: "error",
      detail: `exit ${penLayout.code}`,
    })
  } else {
    frames.forEach(record)
  }
  const apply = await run(
    "apply-pen",
    [join(scripts, "verify-apply-pen.mjs")],
    {
      env: { PORT: "4454", VERIFY_APP_UI_SHOTS: join(out, "apply-pen") },
      stackRun: "apply-pen",
      timeoutMs: remaining(5 * 60 * 1000),
    }
  )
  record({
    id: "apply-pen",
    status: apply.code === 0 ? "pass" : apply.code === 1 ? "fail" : "error",
    detail: `exit ${apply.code}`,
  })
}

const EXTERNAL = [
  { id: "sidebar", script: "verify-sidebar.mjs", style: "port" },
  { id: "letter-start", script: "verify-letter-start.mjs", style: "port" },
  {
    id: "letter-start-unreadable",
    script: "verify-letter-start.mjs",
    style: "port",
    extra: ["--state", "unreadable"],
  },
  {
    id: "letter-drafting",
    script: "verify-letter-drafting.mjs",
    style: "port",
  },
  { id: "letter-editor", script: "verify-letter-editor.mjs", style: "port" },
  { id: "auth-code", script: "verify-auth-code.mjs", style: "port" },
  { id: "auth-welcome", script: "verify-auth-welcome.mjs", style: "url" },
  { id: "session-expired", script: "verify-session-expired.mjs", style: "url" },
]

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
  for (const driver of EXTERNAL) {
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

const verdict = judge({
  results,
  skips,
  today: new Date().toISOString().slice(0, 10),
})
console.log("\n==== screen layout checks ====")
for (const line of verdict.lines) console.log(line)
const skipped = verdict.lines.filter((line) => line.startsWith("SKIPPED"))
if (skipped.length)
  console.log(
    `\n!!!! ${skipped.length} SCREENS ARE SKIPPED AND FAIL ON MAIN. They are not checked. See scripts/ci-screens.skips.json !!!!`
  )
const seconds = Math.round((Date.now() - startedAt) / 1000)
console.log(
  `${verdict.failed || crashed ? "FAILED" : "OK"} in ${seconds}s, ${results.length} results, ${skipped.length} skipped`
)
process.exit(verdict.failed || crashed ? 1 : 0)
