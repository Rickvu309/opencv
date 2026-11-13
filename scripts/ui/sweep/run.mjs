#!/usr/bin/env node
import { UsageError, parseArgs } from "../args.mjs"
import { realPorts } from "../ports.mjs"
import { SWEEP_COMMAND } from "./command.mjs"

let result
try {
  result = await SWEEP_COMMAND.run(
    realPorts(),
    parseArgs(process.argv.slice(2), SWEEP_COMMAND.options)
  )
} catch (error) {
  result = {
    code: error instanceof UsageError ? 2 : 1,
    lines: [`ui sweep: ${error.message}`],
  }
}
for (const line of result.lines) console.log(line)
process.exit(result.code)
