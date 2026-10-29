#!/usr/bin/env node
// Usage: scripts/ocv-task.mjs <help|file|status|take|save|release|cleanup|doctor> ...
// Exit codes: 0 ok, 1 error, 2 refused with a named code, 3 LOST. See `help`.
// The entry is ocv-task.mjs, not ocv-task, because the modules live in scripts/ocv-task/.
import { runCli } from "./ocv-task/cli.mjs"

const { code, text } = runCli(process.argv.slice(2))
console.log(text)
process.exitCode = code
