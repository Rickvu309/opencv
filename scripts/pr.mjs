#!/usr/bin/env node
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
