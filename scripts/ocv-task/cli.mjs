// Dispatcher. runCli returns { code, text } so tests drive it with an injected runner.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { EXIT, Refused, SCRATCH, failure, realRun, render } from "./core.mjs"
import { TEMPLATE_FIELDS } from "./fields.mjs"
import { file } from "./issue.mjs"
import { COMMANDS, doctor, renderHelp, status } from "./report.mjs"

export function realCtx() {
  return {
    run: realRun,
    readFile: (path) => readFileSync(path, "utf8"),
    writeScratch: (name, text) => {
      mkdirSync(SCRATCH, { recursive: true })
      const path = join(SCRATCH, name)
      writeFileSync(path, text)
      return path
    },
    nodeVersion: process.version,
  }
}

export function parseArgs(argv) {
  const valued = new Set([
    "--title",
    "--body-file",
    ...TEMPLATE_FIELDS.map((f) => f.flag),
  ])
  const flags = {}
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    if (valued.has(argv[i])) flags[argv[i]] = argv[++i]
    else if (argv[i].startsWith("-")) flags[argv[i]] = true
    else pos.push(argv[i])
  }
  return { flags, pos }
}

function command(ctx, cmd, rest) {
  const { flags, pos } = parseArgs(rest)
  switch (cmd) {
    case undefined:
    case "help":
      return { lines: [renderHelp()], next: "scripts/ocv-task.mjs doctor" }
    case "file":
      return file(ctx, { flags })
    case "status": {
      const n = Number(pos[0])
      if (!Number.isInteger(n) || n < 1)
        throw new Error("usage: ocv-task status <n>")
      return status(ctx, n)
    }
    case "doctor":
      return doctor(ctx)
    default:
      throw new Refused(
        "UNKNOWN_COMMAND",
        `no command "${cmd}"; commands are ${COMMANDS.map((c) => c.name).join(", ")}`
      )
  }
}

export function runCli(argv, ctx = realCtx()) {
  try {
    const [cmd, ...rest] = argv
    const result = command(ctx, cmd, rest)
    return {
      code: result.exit ?? EXIT.OK,
      text: render(result),
    }
  } catch (error) {
    return failure(error)
  }
}
