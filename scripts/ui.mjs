#!/usr/bin/env node
import { runUi } from "./ui/cli.mjs"
import { realPorts } from "./ui/ports.mjs"

const { code, lines } = await runUi(process.argv.slice(2), realPorts())
for (const line of lines) console.log(line)
process.exit(code)
