#!/usr/bin/env node
import { runCli } from "./ocv-tools/cli.mjs"

const { code, text } = runCli(process.argv.slice(2))
if (text) console.log(text)
process.exitCode = code
