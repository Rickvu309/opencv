#!/usr/bin/env node
// Usage: scripts/pr.mjs release <sha> [--wait <seconds>] [--json]
//        scripts/pr.mjs doctor [--json]
// Exit codes: release 0 LIVE, 3 PENDING (rerun later), 1 BROKEN, RELEASE_BLOCKED or an error;
// doctor 0 no drift, 1 drift or an error.
import { runCli as doctor } from "./pr/doctor.mjs"
import { runCli as release } from "./pr/release.mjs"

const commands = { release, doctor }
const [command, ...args] = process.argv.slice(2)

try {
  if (!commands[command])
    throw new Error(
      `Usage: scripts/pr.mjs <${Object.keys(commands).join("|")}> ...`
    )
  process.exitCode = await commands[command](args)
} catch (error) {
  console.error(`ERROR pr ${command ?? ""}: ${error.message}`)
  process.exitCode = 1
}
