import { openSync, rmSync, writeSync } from "node:fs"

const [pgid, profile, lifetimeMs] = process.argv.slice(2)
const GROUP_EXIT_DEADLINE_MS = 3000
const reportFd = process.env.CHROME_WATCHDOG_REPORT
  ? openSync(process.env.CHROME_WATCHDOG_REPORT, "w")
  : null
const note = (line) => {
  if (reportFd !== null) writeSync(reportFd, `${line}\n`)
}
note("started")

const groupGone = () => {
  try {
    process.kill(-pgid, 0)
    return false
  } catch {
    return true
  }
}

let reaping = false
async function reap() {
  if (reaping) return
  reaping = true
  note("reaping")
  try {
    process.kill(-pgid, "SIGKILL")
  } catch {}
  const deadline = Date.now() + GROUP_EXIT_DEADLINE_MS
  while (!groupGone() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 20))
  rmSync(profile, { recursive: true, force: true })
  note("reaped")
  process.exit(0)
}

let lifetimeStarted = false
process.stdin.on("data", () => {
  if (lifetimeStarted) return
  lifetimeStarted = true
  setTimeout(reap, Number(lifetimeMs))
})
process.stdin.on("end", reap)
process.stdin.on("error", reap)
