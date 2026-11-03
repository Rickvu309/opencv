#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const GIT_TIMEOUT_MS = 10_000
const LOCAL_CONFIG_PATHS = new Set([".claude/settings.local.json"])
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"])
const SEPARATORS = new Set([";", "&", "|", "\n"])
const DIRECTORY_CHANGERS = new Set(["cd", "pushd"])
const COMMAND_PREFIXES = new Set(["sudo", "command", "exec", "time", "env"])
const SED_IN_PLACE = /^(?:-[a-zA-Z]*i[^\s]*|--in-place(?:=.*)?)$/
const SED_SCRIPT_FLAGS = new Set(["-e", "-f", "--expression", "--file"])

export function refusalMessage(target, mainRoot) {
  return [
    `Refused: ${target} is inside the main checkout (${mainRoot}).`,
    "Rule (AGENTS.md, Git, rule 2): never edit files in the main checkout; it stays on main and is only used to fetch, create worktrees, and merge.",
    'Fix: run `scripts/ocv-tools.mjs take <issue#> -d "short description"` (or `scripts/ocv-tools.mjs take "Issue title"` to create the issue first), then make the same change under the worktree path it prints (../opencv.worktrees/<issue#>-short-description).',
  ].join("\n")
}

function stripHeredocBodies(command) {
  return command.replace(
    /<<-?\s*(['"]?)([^\s'"<>|;&()]+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g,
    (match) => match.split("\n")[0]
  )
}

export function segmentsOf(command) {
  const segments = [[]]
  let word = null
  let quote = null
  const flush = () => {
    if (word !== null) segments.at(-1).push({ text: word })
    word = null
  }
  const text = stripHeredocBodies(command)
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quote) {
      if (char === quote) quote = null
      else if (char === "\\" && quote === '"' && index + 1 < text.length) {
        index += 1
        word += text[index]
      } else word += char
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      word ??= ""
    } else if (char === "\\" && index + 1 < text.length) {
      index += 1
      word = (word ?? "") + text[index]
    } else if (char === " " || char === "\t") flush()
    else if (SEPARATORS.has(char)) {
      flush()
      if (char === "&" && text[index - 1] === ">") continue
      segments.push([])
    } else if (char === ">" || char === "<") {
      if (char === ">" && word !== null && /^\d+$/.test(word)) word = null
      flush()
      let op = char
      while (text[index + 1] === char || text[index + 1] === "|") {
        index += 1
        op += text[index]
      }
      if (char === ">" && text[index + 1] === "&") {
        index += 1
        while (/[\w-]/.test(text[index + 1] ?? "")) index += 1
        continue
      }
      segments.at(-1).push({ text: op, op: char })
    } else word = (word ?? "") + char
  }
  flush()
  return segments.filter((segment) => segment.length > 0)
}

function splitRedirects(segment) {
  const words = []
  const redirects = []
  for (let index = 0; index < segment.length; index += 1) {
    const token = segment[index]
    if (token.op === ">") {
      const target = segment[index + 1]
      if (target && !target.op) redirects.push(target.text)
      index += 1
    } else if (token.op === "<") index += 1
    else words.push(token.text)
  }
  return { words, redirects }
}

function commandWords(words) {
  let start = 0
  while (
    start < words.length &&
    (/^\w+=/.test(words[start]) || COMMAND_PREFIXES.has(words[start]))
  )
    start += 1
  return words.slice(start)
}

function sedFiles(args) {
  const hasScriptFlag = args.some((arg) => SED_SCRIPT_FLAGS.has(arg))
  const files = []
  let scriptSeen = hasScriptFlag
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (SED_SCRIPT_FLAGS.has(arg)) index += 1
    else if (arg.startsWith("-") && arg !== "-") continue
    else if (!scriptSeen) scriptSeen = true
    else files.push(arg)
  }
  return files
}

function operandTargets(name, args) {
  const operands = []
  let directory = null
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "-t" || arg === "--target-directory") {
      directory = args[index + 1] ?? null
      index += 1
    } else if (arg.startsWith("--target-directory=")) {
      directory = arg.slice("--target-directory=".length)
    } else if (!arg.startsWith("-") || arg === "-") operands.push(arg)
  }
  if (name === "tee") return operands
  if (directory) return [directory]
  return operands.length >= 2 ? [operands.at(-1)] : []
}

export function bashTargets(command) {
  const segments = segmentsOf(command)
  const changesDirectory = segments.some((segment) => {
    const words = commandWords(splitRedirects(segment).words)
    return DIRECTORY_CHANGERS.has(words[0])
  })
  const targets = []
  for (const segment of segments) {
    const { words, redirects } = splitRedirects(segment)
    targets.push(...redirects)
    const [first, ...args] = commandWords(words)
    if (!first) continue
    const name = path.basename(first)
    if (name === "sed" && args.some((arg) => SED_IN_PLACE.test(arg)))
      targets.push(...sedFiles(args))
    else if (name === "tee" || name === "cp" || name === "mv")
      targets.push(...operandTargets(name, args))
  }
  return targets
    .filter(isLiteralTarget)
    .filter((target) => !changesDirectory || isAbsoluteOrHome(target))
}

function isAbsoluteOrHome(target) {
  return path.isAbsolute(target) || target === "~" || target.startsWith("~/")
}

function isLiteralTarget(target) {
  return (
    target !== "" && !/[$`*?{}]/.test(target) && !target.startsWith("/dev/")
  )
}

export function targetsOf(input) {
  const toolInput = input.tool_input ?? {}
  if (EDIT_TOOLS.has(input.tool_name))
    return [toolInput.file_path, toolInput.notebook_path].filter(
      (value) => typeof value === "string" && value !== ""
    )
  if (input.tool_name === "Bash" && typeof toolInput.command === "string")
    return bashTargets(toolInput.command)
  return []
}

function resolveReal(target, cwd) {
  const expanded =
    target === "~" || target.startsWith("~/")
      ? path.join(homedir(), target.slice(1))
      : target
  const absolute = path.resolve(cwd, expanded)
  let existing = absolute
  const rest = []
  while (!existsSync(existing) && path.dirname(existing) !== existing) {
    rest.unshift(path.basename(existing))
    existing = path.dirname(existing)
  }
  return path.join(realpathSync(existing), ...rest)
}

export function isInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  )
}

export function mainCheckoutOf(cwd) {
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      {
        cwd,
        encoding: "utf8",
        timeout: GIT_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "ignore"],
      }
    ).trim()
    if (path.basename(common) !== ".git") return null
    return realpathSync(path.dirname(common))
  } catch {
    return null
  }
}

function isLocalConfig(mainRoot, resolved) {
  return LOCAL_CONFIG_PATHS.has(path.relative(mainRoot, resolved))
}

export function refusal(input, findMain = mainCheckoutOf) {
  const cwd = input.cwd || process.cwd()
  const targets = targetsOf(input)
  if (targets.length === 0) return null
  const mainRoot = findMain(cwd)
  if (!mainRoot) return null
  for (const target of targets) {
    const resolved = resolveReal(target, cwd)
    if (isLocalConfig(mainRoot, resolved)) continue
    if (isInside(mainRoot, resolved)) return refusalMessage(resolved, mainRoot)
  }
  return null
}

function main() {
  let input
  try {
    input = JSON.parse(readFileSync(0, "utf8"))
  } catch {
    return 0
  }
  const message = refusal(input)
  if (!message) return 0
  process.stderr.write(`${message}\n`)
  return 2
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main()
