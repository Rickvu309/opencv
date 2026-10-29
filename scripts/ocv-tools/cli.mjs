// Dispatcher. runCli returns { code, text } so tests drive it with an injected runner.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { EXIT, Refused, SCRATCH, failure, realRun, render } from "./core.mjs"
import { TEMPLATE_FIELDS } from "./fields.mjs"
import { release } from "./claim.mjs"
import { take } from "./take.mjs"
import { file } from "./issue.mjs"
import { COMMANDS, doctor, renderHelp, status } from "./report.mjs"
import { cleanup, save } from "./work.mjs"

export function realCtx() {
  return {
    run: realRun,
    readFile: (path) => readFileSync(path, "utf8"),
    writeScratch: (name, text) => {
      const path = join(SCRATCH, name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
      return path
    },
    writeFile: (path, text) => writeFileSync(path, text),
    now: () => Date.now(),
    nodeVersion: process.version,
  }
}

export function parseArgs(argv) {
  const valued = new Set([
    "--title",
    "--body-file",
    "-m",
    "-d",
    "--reason",
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

function issueNumber(text, usage) {
  const n = Number(String(text ?? "").replace(/^#/, ""))
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`usage: ocv-tools ${usage}`)
  return n
}

function command(ctx, cmd, rest) {
  const { flags, pos } = parseArgs(rest)
  switch (cmd) {
    case undefined:
    case "help":
      return { lines: [renderHelp()], next: "scripts/ocv-tools.mjs doctor" }
    case "file":
      return file(ctx, { flags })
    case "status":
      return status(ctx, issueNumber(pos[0], "status <n>"))
    case "take": {
      if (!pos[0]) throw new Error("usage: ocv-tools take <n | title>")
      return take(ctx, pos[0], flags)
    }
    case "save":
      return save(ctx, { message: flags["-m"] })
    case "release":
      return release(ctx, {
        n: pos[0] ? issueNumber(pos[0], "release --reason <why> [<n>]") : null,
        reason: flags["--reason"],
      })
    case "cleanup":
      return cleanup(ctx, {
        n: pos[0] ? issueNumber(pos[0], "cleanup [<n> | --all]") : null,
        flags,
      })
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
