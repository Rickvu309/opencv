import { readFileSync } from "node:fs"
import { EXIT, failure, render } from "./result.mjs"
import { badInput, needsValue, unknownOption } from "./input.mjs"
import { createFacts } from "./facts.mjs"
import { realPorts } from "./ports/index.mjs"
import { TEMPLATE_FIELDS, TYPES } from "./fields.mjs"
import { slugify } from "./worktree.mjs"
import { take } from "./take.mjs"
import { TAKE_SWITCHES, file } from "./issue.mjs"
import { COMMANDS, doctor, renderHelp } from "./report.mjs"
import { rulesJob } from "./rules/command.mjs"
import { cleanup, save } from "./work.mjs"
import { shot } from "./shot.mjs"
import { brief } from "./brief.mjs"
import { block, done } from "./done.mjs"
import { replaceBody } from "./jobs/body.mjs"
import { finish } from "./jobs/finish.mjs"
import { hook } from "./jobs/hook.mjs"
import { merge } from "./jobs/merge.mjs"
import { policyReport } from "./jobs/policy.mjs"
import { why } from "./jobs/why.mjs"
import { retire } from "./jobs/retire.mjs"
import { pullFacts } from "./jobs/pull-facts.mjs"

export function realCtx() {
  const ports = realPorts()
  return {
    ports,
    env: ports.env,
    now: () => ports.clock.now(),
    pause: (seconds) => ports.clock.pause(seconds),
    nodeVersion: process.version,
    cwd: process.cwd(),
    readStdin: () => {
      try {
        return readFileSync(0, "utf8")
      } catch {
        return ""
      }
    },
    readFile: (path) => ports.fs.read(path),
    writeFile: (path, text) => ports.fs.write(path, text),
    writeScratch: (name, text) => ports.fs.scratch(name, text),
  }
}

const VALUED = new Set([
  "--desc",
  "--title",
  "--body-file",
  "-m",
  "-d",
  "--reason",
  "--pr",
  "--issue",
  "--name",
  "--role",
  "--allow-migration",
  "--because",
  "--replaced-by",
  ...TEMPLATE_FIELDS.map((f) => f.flag),
])

export function parseArgs(argv) {
  const flags = {}
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    if (VALUED.has(argv[i])) flags[argv[i]] = argv[++i]
    else if (argv[i].startsWith("-")) flags[argv[i]] = true
    else pos.push(argv[i])
  }
  return { flags, pos }
}

const TAKE_BOOL = new Set(TAKE_SWITCHES)

const RETIRED_FLAG = {
  "--desc": "-d",
  "-b": "--body-file",
  "--body": "--body-file",
}

function takeValued() {
  return new Set([
    "-d",
    "--title",
    "--body-file",
    ...TEMPLATE_FIELDS.map((f) => f.flag),
  ])
}

function targetKind(text) {
  const raw = String(text)
  if (/^#/.test(raw) || /^\d+$/.test(raw) || /^\d+\.\d+$/.test(raw)) {
    const n = Number(raw.replace(/^#/, ""))
    if (!Number.isInteger(n) || n < 1) return "bad"
    return "issue"
  }
  return "title"
}

const FLAG_TOKEN = /^--?[A-Za-z]/

export const isMissingFlagValue = (value) =>
  value == null || FLAG_TOKEN.test(value)

function parseTakeArgs(argv) {
  const valued = takeValued()
  const flags = {}
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (valued.has(arg)) {
      const value = argv[i + 1]
      if (isMissingFlagValue(value)) needsValue(arg)
      flags[arg] = value
      i += 1
      continue
    }
    if (TAKE_BOOL.has(arg)) {
      flags[arg] = true
      continue
    }
    if (arg.startsWith("-")) {
      unknownOption(arg, RETIRED_FLAG[arg])
    }
    pos.push(arg)
  }
  return { flags, pos }
}

function guardTake(flags, pos) {
  if (!pos.length) throw new Error("usage: ocv-tools take <n | title>")
  if (pos.length > 1) {
    const kinds = pos.map(targetKind)
    const both = kinds.some((k) => k !== "title") && kinds.includes("title")
    badInput({ args: { ok: false, both, count: pos.length } })
  }
  if (targetKind(pos[0]) === "bad")
    badInput({ token: { ok: false, text: pos[0] } })
  if (
    targetKind(pos[0]) === "issue" &&
    flags["--type"] != null &&
    !TYPES.includes(flags["--type"])
  )
    badInput({ flags, validateType: true })
  if (flags["-d"] != null && !slugify(flags["-d"]))
    badInput({ flags, desc: flags["-d"] })
}

function issueNumber(text, usage) {
  const n = Number(String(text ?? "").replace(/^#/, ""))
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`usage: ocv-tools ${usage}`)
  return n
}

const HELP_WORDS = ["--help", "-h"]

function asksForHelp(words) {
  for (let i = 0; i < words.length; i++) {
    if (VALUED.has(words[i])) i += 1
    else if (HELP_WORDS.includes(words[i])) return true
  }
  return false
}

function command(ctx, cmd, rest) {
  const asked = COMMANDS.find((c) => c.name === cmd)
  if (asked && asksForHelp(rest))
    return {
      lines: [`Usage: scripts/ocv-tools.mjs ${asked.usage}`, asked.when],
      next: "scripts/ocv-tools.mjs help",
    }
  const { flags, pos } = parseArgs(rest)
  switch (cmd) {
    case undefined:
    case "--help":
    case "-h":
    case "help":
      return { lines: [renderHelp()], next: "scripts/ocv-tools.mjs doctor" }
    case "file":
      return file(ctx, { flags })
    case "take": {
      const parsed = parseTakeArgs(rest)
      guardTake(parsed.flags, parsed.pos)
      return take(ctx, parsed.pos[0], parsed.flags)
    }
    case "body": {
      for (const flag of Object.keys(flags)) {
        if (flag !== "--body-file") unknownOption(flag)
        if (flags[flag] == null || String(flags[flag]).startsWith("--"))
          needsValue(flag)
      }
      if (pos.length !== 1)
        throw new Error("usage: ocv-tools body <pr> --body-file <file>")
      return replaceBody(
        ctx,
        issueNumber(pos[0], "body <pr> --body-file <file>"),
        { flags }
      )
    }
    case "finish":
    case "merge": {
      const allowed =
        cmd === "finish"
          ? ["--body-file", "-d", "--desc", "--draft", "--dry-run"]
          : cmd === "merge"
            ? ["--allow-migration"]
            : []
      for (const flag of Object.keys(flags)) {
        if (!allowed.includes(flag)) unknownOption(flag)
        if (
          ["--body-file", "-d", "--desc", "--allow-migration"].includes(flag) &&
          (flags[flag] == null || String(flags[flag]).startsWith("--"))
        )
          needsValue(flag)
      }
      if (pos.length !== (cmd === "merge" ? 1 : 0))
        throw new Error(
          `usage: ocv-tools ${cmd}${cmd === "merge" ? " <pr#>" : ""}`
        )
      if (cmd === "finish") return finish(ctx, { flags })
      return merge(ctx, issueNumber(pos[0], "merge <pr#>"), {
        allowMigrations: String(flags["--allow-migration"] ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
    }
    case "save":
      return save(ctx, { message: flags["-m"] })
    case "cleanup":
      return cleanup(ctx, {
        n: pos[0] ? issueNumber(pos[0], "cleanup [<n> | --all]") : null,
        flags,
      })
    case "policy": {
      const unknown = Object.keys(flags)[0]
      if (unknown) unknownOption(unknown)
      if (pos.length !== 1) throw new Error("usage: ocv-tools policy <pr#>")
      const n = issueNumber(pos[0], "policy <pr#>")
      return policyReport(n, pullFacts(ctx, n), {
        annotate: ctx.env.GITHUB_ACTIONS === "true",
      })
    }
    case "retire": {
      const unknown = Object.keys(flags).find(
        (flag) => !["--because", "--replaced-by"].includes(flag)
      )
      if (unknown) unknownOption(unknown)
      if (pos.length !== 1)
        throw new Error(
          'usage: ocv-tools retire "<subject>" --because "<why>" [--replaced-by <test file>]'
        )
      return retire(ctx, {
        subject: pos[0],
        because: flags["--because"],
        replacedBy: flags["--replaced-by"],
      })
    }
    case "why": {
      const unknown = Object.keys(flags)[0]
      if (unknown) unknownOption(unknown)
      if (pos.length !== 1) throw new Error("usage: ocv-tools why <pr#>")
      const n = issueNumber(pos[0], "why <pr#>")
      return { id: n, lines: why(ctx, n), next: `gh pr checks ${n}` }
    }
    case "hook": {
      const unknown = Object.keys(flags)[0]
      if (unknown) unknownOption(unknown)
      if (!pos.length)
        throw new Error(
          "usage: ocv-tools hook <commit-msg|pre-commit|pre-push>"
        )
      return hook(ctx, pos[0], pos.slice(1))
    }
    case "brief":
      return brief(ctx, issueNumber(pos[0], "brief <issue> --role <role>"), {
        role: flags["--role"],
      })
    case "done":
      return done(ctx)
    case "block":
      return block(ctx, issueNumber(pos[0], "block <n> <reason>"), pos[1])
    case "shot":
      return shot(ctx, { files: pos, flags })
    case "doctor":
      return doctor(ctx)
    case "rules":
      return rulesJob(ctx, { flags })
    default:
      return badInput({
        command: {
          known: false,
          name: cmd,
          names: COMMANDS.map((c) => c.name).join(", "),
        },
      })
  }
}

export function runCli(argv, ctx = realCtx()) {
  ctx.facts = createFacts(ctx.ports, () => ctx.cwd)
  try {
    const [cmd, ...rest] = argv
    const result = command(ctx, cmd, rest)
    return {
      code: result.exit ?? EXIT.ok,
      text: render(result),
    }
  } catch (error) {
    return failure(error)
  }
}
