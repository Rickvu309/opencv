import assert from "node:assert/strict"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import {
  chmodSync,
  createReadStream,
  readdirSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const self = path.relative(root, fileURLToPath(import.meta.url))

const tracked = (...patterns) =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", ...patterns],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)

const launchers = tracked(".claude/skills/**/cdp.mjs")
const chromeModule = "scripts/lib/chrome-process.mjs"

const PENDING = []

const isZombie = (pid) => {
  try {
    return /^\d+ \(.*\) Z /.test(readFileSync(`/proc/${pid}/stat`, "utf8"))
  } catch {
    return false
  }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return !isZombie(pid)
  } catch {
    return false
  }
}

test("a browser is started only by a cdp.mjs launcher", () => {
  const strays = tracked("*.mjs", "*.js", "*.ts", "*.sh")
    .filter(
      (file) =>
        file !== self && file !== chromeModule && !launchers.includes(file)
    )
    .filter((file) =>
      readFileSync(path.join(root, file), "utf8").includes("--remote-debugging")
    )
  assert.deepEqual(
    strays,
    [],
    `${strays.join(", ")} starts a browser itself. Use launchBrowser from a cdp.mjs launcher, which kills Chrome and its children on every failure path.`
  )
  assert.ok(launchers.length > 0, "no cdp.mjs launcher found")
})

for (const launcher of launchers) {
  test(`${launcher} leaves no browser running after a failed launch`, (t) => {
    const pending = PENDING.find((entry) => entry.file === launcher)
    if (pending) {
      t.skip(`${pending.issue} until ${pending.expires}`)
      return
    }
    const scratch = path.join(homedir(), "tmp")
    mkdirSync(scratch, { recursive: true })
    const dir = mkdtempSync(path.join(scratch, "launcher-guard-"))
    const mainPid = path.join(dir, "main.pid")
    const childPid = path.join(dir, "child.pid")
    const fake = path.join(dir, "fake-chrome.sh")
    writeFileSync(
      fake,
      [
        "#!/bin/sh",
        "tail -f /dev/null &",
        `echo $! > ${childPid}`,
        `echo $$ > ${mainPid}`,
        'echo "DevTools listening on ws://127.0.0.1:1/devtools/browser/fake" >&2',
        "wait",
      ].join("\n")
    )
    chmodSync(fake, 0o755)
    try {
      const run = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `const { launchBrowser } = await import(${JSON.stringify(path.join(root, launcher))});
           try { await launchBrowser() } catch (error) { console.log("rejected: " + error.message) }`,
        ],
        {
          env: { ...process.env, CHROME_BIN: fake },
          encoding: "utf8",
          timeout: 15000,
        }
      )
      assert.equal(
        run.signal,
        null,
        `${launcher}: the process was still running 15 s after launchBrowser failed, because Chrome or its stderr pipe stayed open. Start Chrome detached and kill its process group on every failure path.`
      )
      assert.match(run.stdout, /rejected:/, "launchBrowser must reject")
      for (const file of [mainPid, childPid]) {
        const pid = Number(readFileSync(file, "utf8"))
        assert.equal(
          alive(pid),
          false,
          `${launcher}: process ${pid} (${path.basename(file)}) outlived a failed launch. Kill the whole process group, not only the main process.`
        )
      }
    } finally {
      for (const file of [mainPid, childPid]) {
        if (!existsSync(file)) continue
        try {
          process.kill(Number(readFileSync(file, "utf8")), "SIGKILL")
        } catch {}
      }
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

for (const launcher of launchers) {
  test(`${launcher} starts Chrome once more when the first start is silent`, (t) => {
    const pending = PENDING.find((entry) => entry.file === launcher)
    if (pending) {
      t.skip(`${pending.issue} until ${pending.expires}`)
      return
    }
    const scratch = path.join(homedir(), "tmp")
    mkdirSync(scratch, { recursive: true })
    const dir = mkdtempSync(path.join(scratch, "launcher-retry-"))
    const counter = path.join(dir, "count")
    const fake = path.join(dir, "fake-chrome.sh")
    writeFileSync(
      fake,
      [
        "#!/bin/sh",
        `echo x >> ${counter}`,
        `if [ "$(wc -l < ${counter})" -eq 1 ]; then exec sleep 30; fi`,
        'echo "DevTools listening on ws://127.0.0.1:1/devtools/browser/fake" >&2',
        "sleep 30",
      ].join("\n")
    )
    chmodSync(fake, 0o755)
    try {
      const run = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `const { launchBrowser } = await import(${JSON.stringify(path.join(root, launcher))});
           try { await launchBrowser({ startDeadlineMs: 300 }) } catch (error) { console.log("rejected: " + error.message) }`,
        ],
        {
          env: { ...process.env, CHROME_BIN: fake },
          encoding: "utf8",
          timeout: 15000,
        }
      )
      const launches = existsSync(counter)
        ? readFileSync(counter, "utf8").split("\n").filter(Boolean).length
        : 0
      assert.equal(
        launches,
        2,
        `${launcher}: Chrome was started ${launches} time(s) after a silent first start. On CI the first start takes 9 to 22 s, so launchBrowser({ startDeadlineMs }) must start Chrome once more, as the verify-app-ui cdp.mjs does.`
      )
      assert.match(run.stdout, /devtools socket failed/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

const DRIVER = `
import { createServer } from "node:http"
import { createHash } from "node:crypto"
const server = createServer()
server.on("upgrade", (request, socket) => {
  const accept = createHash("sha1")
    .update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64")
  socket.write("HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: " + accept + "\\r\\n\\r\\n")
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
process.env.FAKE_PORT = String(server.address().port)
const { launchBrowser } = await import(process.env.LAUNCHER)
await launchBrowser()
console.log("ready")
if (process.env.MODE === "exit") process.exit(0)
if (process.env.MODE === "throw") throw new Error("driver crashed")
await new Promise(() => {})
`

const SCENARIOS = [
  { name: "SIGTERM", signal: "SIGTERM", code: 143 },
  { name: "SIGINT", signal: "SIGINT", code: 130 },
  { name: "SIGHUP", signal: "SIGHUP", code: 129 },
  { name: "SIGKILL", signal: "SIGKILL" },
  { name: "exit", mode: "exit" },
  { name: "throw", mode: "throw" },
  { name: "lifetime", lifetimeMs: "1" },
]

for (const launcher of launchers) {
  for (const scenario of SCENARIOS) {
    test(
      `${launcher} leaves no browser running after the driver gets ${scenario.name}`,
      { timeout: 90000 },
      async (t) => {
        const pending = PENDING.find((entry) => entry.file === launcher)
        if (pending) {
          t.skip(`${pending.issue} until ${pending.expires}`)
          return
        }
        const scratch = path.join(homedir(), "tmp")
        mkdirSync(scratch, { recursive: true })
        const dir = mkdtempSync(path.join(scratch, "launcher-orphan-"))
        const mainPid = path.join(dir, "main.pid")
        const childPid = path.join(dir, "child.pid")
        const fifo = path.join(dir, "held")
        const fake = path.join(dir, "fake-chrome.sh")
        const report = path.join(dir, "watchdog")
        const launcherName = launcher.includes("verify-landing")
          ? "verify-landing"
          : "verify-app-ui"
        execFileSync("mkfifo", [fifo, report])
        writeFileSync(
          fake,
          [
            "#!/bin/sh",
            `exec 3> ${fifo}`,
            "tail -f /dev/null &",
            `echo $! > ${childPid}`,
            `echo $$ > ${mainPid}`,
            'echo "DevTools listening on ws://127.0.0.1:$FAKE_PORT/devtools/browser/fake" >&2',
            "wait",
          ].join("\n")
        )
        chmodSync(fake, 0o755)
        const watchdogReader = createReadStream(report)
        let watchdogLog = ""
        watchdogReader.on("data", (chunk) => (watchdogLog += chunk))
        const watchdogExited = new Promise((resolve, reject) => {
          watchdogReader.on("end", resolve)
          watchdogReader.on("error", reject)
        })
        const stalled = new Promise((_, reject) =>
          t.signal.addEventListener("abort", () =>
            reject(
              new Error(
                `stalled. watchdog log: ${JSON.stringify(watchdogLog)}; driver output: ${JSON.stringify(output)}; driver errors: ${JSON.stringify(errors)}`
              )
            )
          )
        )
        stalled.catch(() => {})
        const reader = createReadStream(fifo)
        const allClosed = new Promise((resolve, reject) => {
          reader.on("end", resolve)
          reader.on("error", reject)
          reader.resume()
        })
        const driver = spawn(
          process.execPath,
          ["--input-type=module", "-e", DRIVER],
          {
            env: {
              ...process.env,
              HOME: dir,
              CHROME_BIN: fake,
              LAUNCHER: path.join(root, launcher),
              MODE: scenario.mode ?? "wait",
              CHROME_MAX_LIFETIME_MS: scenario.lifetimeMs ?? "",
              CHROME_WATCHDOG_REPORT: report,
            },
            stdio: ["ignore", "pipe", "pipe"],
          }
        )
        let output = ""
        const ready = new Promise((resolve) => {
          driver.stdout.on("data", (chunk) => {
            output += chunk
            if (output.includes("ready")) resolve()
          })
          driver.on("close", resolve)
        })
        let errors = ""
        driver.stderr.on("data", (chunk) => (errors += chunk))
        const closed = new Promise((resolve) =>
          driver.on("close", (code, signal) => resolve({ code, signal }))
        )
        try {
          await ready
          if (scenario.signal) driver.kill(scenario.signal)
          if (!scenario.lifetimeMs) await closed
          await Promise.race([
            Promise.all([allClosed, watchdogExited]),
            stalled,
          ])
          assert.deepEqual(
            readdirSync(path.join(dir, "tmp", launcherName)),
            [],
            "the profile directory must be removed"
          )
          if (scenario.code !== undefined)
            assert.equal((await closed).code, scenario.code, errors)
        } finally {
          driver.kill("SIGKILL")
          reader.destroy()
          watchdogReader.destroy()
          for (const file of [mainPid, childPid]) {
            if (!existsSync(file)) continue
            try {
              process.kill(Number(readFileSync(file, "utf8")), "SIGKILL")
            } catch {}
          }
          rmSync(dir, { recursive: true, force: true })
        }
      }
    )
  }
}

test("pending launcher fixes have not expired", () => {
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
})
