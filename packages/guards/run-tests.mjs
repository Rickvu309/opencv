import { execFileSync, spawn } from "node:child_process"
import { availableParallelism } from "node:os"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
export const SLOW = "scripts/ocv-tools/jobs/finish.test.mjs"

const gitList = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.test.mjs"],
    { cwd: root, encoding: "utf8" }
  )

export function discoverTests(list = gitList) {
  const files = list()
    .split("\n")
    .filter(Boolean)
    .filter((file) => file !== SLOW)
    .sort()
  if (files.length === 0)
    throw new Error("git ls-files found no *.test.mjs file")
  return files
}

export const FILE_TIMEOUT_MS = 180_000
export const SLOW_FILE_TIMEOUT_MS = 600_000

export function runFile(
  file,
  {
    timeoutMs,
    cwd = root,
    timers = { start: setTimeout, stop: clearTimeout },
  } = {}
) {
  return new Promise((resolve) => {
    const started = Date.now()
    const { NODE_TEST_CONTEXT: _outerNodeTestContext, ...env } = process.env
    const child = spawn(
      process.execPath,
      ["--test", `--test-timeout=${Math.floor(timeoutMs * 0.8)}`, file],
      { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] }
    )
    let output = ""
    let timedOut = false
    const collect = (chunk) => {
      output += chunk
    }
    child.stdout.on("data", collect)
    child.stderr.on("data", collect)
    const killLeftoverProcesses = () => {
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {
        child.kill("SIGKILL")
      }
    }
    const timer = timers.start(() => {
      timedOut = true
      killLeftoverProcesses()
    }, timeoutMs)
    child.on("error", (error) => {
      timers.stop(timer)
      resolve({ file, ok: false, timedOut, output: String(error), ms: 0 })
    })
    child.on("close", (code) => {
      timers.stop(timer)
      killLeftoverProcesses()
      resolve({
        file,
        ok: code === 0 && !timedOut,
        timedOut,
        output,
        ms: Date.now() - started,
      })
    })
  })
}

export async function runFiles(
  files,
  {
    timeoutMs,
    timers,
    concurrency = Math.max(1, availableParallelism() - 1),
    cwd,
    log = console.log,
  } = {}
) {
  const queue = [...files]
  const results = []
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const result = await runFile(file, { timeoutMs, cwd, timers })
      results.push(result)
      if (!result.ok) {
        log(result.output.trimEnd().split("\n").slice(-60).join("\n"))
        log(
          result.timedOut
            ? `TIMEOUT ${file}: still running after ${timeoutMs} ms, killed`
            : `FAIL ${file}`
        )
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  const failed = results.filter((result) => !result.ok)
  const slowest = [...results].sort((a, b) => b.ms - a.ms)[0]
  log(
    `${results.length - failed.length}/${results.length} test files passed` +
      (slowest ? `, slowest ${slowest.file} ${slowest.ms} ms` : "")
  )
  return results
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const open = process.argv.includes("--open-pr")
  const files = open ? [SLOW] : discoverTests()
  const timeoutMs =
    Number(process.env.GUARDS_FILE_TIMEOUT_MS) ||
    (open ? SLOW_FILE_TIMEOUT_MS : FILE_TIMEOUT_MS)
  const results = await runFiles(files, { timeoutMs })
  process.exit(results.every((result) => result.ok) ? 0 : 1)
}
