#!/usr/bin/env node
// Usage: scripts/pr.mjs release <sha> [--wait <seconds>] [--json]
// Exit codes: 0 LIVE, 3 PENDING (rerun later), 1 BROKEN, RELEASE_BLOCKED or an error.
import { runCli as release } from "./pr/release.mjs"

const commands = { release }
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
