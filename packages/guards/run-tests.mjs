import { execFileSync, spawn } from "node:child_process"
import { availableParallelism } from "node:os"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
// The finish suite is the slow one, so it runs in its own task (test:open-pr).
export const SLOW = "scripts/ocv-tools/jobs/finish.test.mjs"

const gitList = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.test.mjs"],
    { cwd: root, encoding: "utf8" }
  )

// Every node:test file in the repo except the slow finish suite, which has its own script.
// An empty or failed listing throws: running no guards must never read as a pass.
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

// The slowest file takes about 15 seconds on a laptop (a headless Chrome launch and the shell suites), so
// 180 seconds leaves a hosted runner an order of magnitude of slack. The finish suite runs many git
// repositories and gets more. GUARDS_FILE_TIMEOUT_MS overrides both.
export const FILE_TIMEOUT_MS = 180_000
export const SLOW_FILE_TIMEOUT_MS = 600_000

// node --test --test-timeout only fails a test that is still running. A file whose tests all finished but
// whose process never exits (a child or a timer keeps the event loop alive) would hang the job with no
// output, so each file gets its own process and its own deadline, and the deadline names the file. A test that
// is still running at 80% of the deadline fails first, by its own name.
export function runFile(file, { timeoutMs, cwd = root } = {}) {
  return new Promise((resolve) => {
    const started = Date.now()
    // Under an outer node --test the child would read this and run as a bare worker, not a runner.
    const { NODE_TEST_CONTEXT: _outer, ...env } = process.env
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
    const killGroup = () => {
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {
        child.kill("SIGKILL")
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      killGroup()
    }, timeoutMs)
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({ file, ok: false, timedOut, output: String(error), ms: 0 })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      // A passing file can leave grandchildren behind (a browser); never leave them for the runner to inherit.
      killGroup()
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

// Runs every file, at most `concurrency` at a time, and prints one line per file that failed or hung.
export async function runFiles(
  files,
  {
    timeoutMs,
    concurrency = Math.max(1, availableParallelism() - 1),
    cwd,
    log = console.log,
  } = {}
) {
  const queue = [...files]
  const results = []
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const result = await runFile(file, { timeoutMs, cwd })
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
