import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  chmodSync,
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

const PENDING = [
  {
    file: ".claude/skills/verify-app-ui/scripts/lib/cdp.mjs",
    issue: "#831",
    expires: "2026-11-16",
  },
]

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test("a browser is started only by a cdp.mjs launcher", () => {
  const strays = tracked("*.mjs", "*.js", "*.ts", "*.sh")
    .filter((file) => file !== self && !launchers.includes(file))
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

test("pending launcher fixes have not expired", () => {
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
})
