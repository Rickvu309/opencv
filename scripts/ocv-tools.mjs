#!/usr/bin/env node
// Usage: scripts/ocv-tools.mjs <help|check|finish|merge|policy|file|status|take|save|release|cleanup|board|approve|shot|rules|doctor> ...
// Exit codes: 0 ok, 1 error, 2 refused, 3 lost, 4 human. See `help`.
// The entry is ocv-tools.mjs, not ocv-tools, because the modules live in scripts/ocv-tools/.
import { runCli } from "./ocv-tools/cli.mjs"

const { code, text } = runCli(process.argv.slice(2))
console.log(text)
process.exitCode = code
