import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

const BUILTIN = new Set([
  "add",
  "audit",
  "config",
  "dlx",
  "exec",
  "filter",
  "i",
  "install",
  "link",
  "list",
  "ls",
  "outdated",
  "pack",
  "publish",
  "remove",
  "rm",
  "root",
  "run",
  "store",
  "unlink",
  "up",
  "update",
  "why",
])

const EXTERNAL = [
  {
    file: ".claude/skills/verify-command-registry/SKILL.md",
    ref: "scripts/hydrate-symlinks.js",
    why: "a script inside the embedded-postgres npm package, run from its own folder",
  },
]

const SCRIPT_PATH = /(?<![\w./-])(?:\.\/)?scripts\/[\w./-]*\w/g
const BARE_SCRIPT = /(?<![\w./-])[\w-][\w.-]*\.sh(?![\w/-])/g
const PNPM_RUN =
  /\bpnpm((?:[ \t]+(?:-F|--filter|-C|--dir)(?:[ \t]+|=)\S+)*)[ \t]+(?:run[ \t]+)?([A-Za-z][\w:.-]*)/g
const PNPM_SELECTOR = /(-F|--filter|-C|--dir)(?:[ \t]+|=)(\S+)/g
const PACKAGE_TOKEN = /^[@\w./-]+(?:\.\.\.)?$/
const REPO_FILE = String.raw`(?:apps|packages|scripts|docs|\.claude)\/[\w./-]+\.\w+`
const LINE_WORD_REF = new RegExp(
  String.raw`\`(${REPO_FILE})\`\s+lines?\s+(\d+)(?:\s*(?:-|,|and)\s*(\d+))?`,
  "g"
)
const COLON_REF = new RegExp(
  String.raw`(?<![\w./-])(${REPO_FILE}):(\d+)(?:-(\d+))?`,
  "g"
)

const trimmedScope = (filter) => filter.replace(/\.\.\.$/, "")

function relativeDir(value) {
  if (path.posix.isAbsolute(value)) return null
  const dir = path.posix.normalize(value).replace(/\/$/, "")
  return dir === "." ? "" : dir
}

function selectedPackages(options, deps) {
  const dirs = []
  const unknown = []
  let checkable = true
  for (const [, flag, raw] of options.matchAll(PNPM_SELECTOR)) {
    const value = raw.replace(/^["']|["']$/g, "")
    const byDirectory =
      flag === "-C" || flag === "--dir" || /^\.{1,2}\//.test(value)
    if (byDirectory) {
      const dir = relativeDir(value)
      if (dir === null) checkable = false
      else dirs.push(dir)
    } else if (!PACKAGE_TOKEN.test(value)) checkable = false
    else {
      const dir = deps.packageDir(trimmedScope(value))
      if (dir === null) unknown.push(value)
      else dirs.push(dir)
    }
  }
  return { dirs, unknown, checkable }
}

const workspaceDirs = () =>
  ["apps", "packages"].flatMap((group) =>
    existsSync(path.join(root, group))
      ? readdirSync(path.join(root, group))
          .map((name) => path.posix.join(group, name))
          .filter((dir) => existsSync(path.join(root, dir, "package.json")))
      : []
  )

export function repoDeps() {
  const readPackage = (dir) =>
    JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8"))
  const dirs = ["", ...workspaceDirs()]
  const packages = new Map(dirs.map((dir) => [dir, readPackage(dir)]))
  return {
    exists: (rel) => existsSync(path.join(root, rel)),
    packageDir: (name) =>
      dirs.find((dir) => packages.get(dir).name === name) ?? null,
    scripts: (dir) => new Set(Object.keys(packages.get(dir)?.scripts ?? {})),
    lineCount: (rel) => {
      const full = path.join(root, rel)
      if (!existsSync(full)) return null
      return readFileSync(full, "utf8").replace(/\n$/, "").split("\n").length
    },
  }
}

const resolves = (ref, dirs, deps) =>
  dirs.some((dir) => deps.exists(path.posix.join(dir, ref)))

export function detect(text, file, deps = repoDeps()) {
  const skill = /^\.claude\/skills\/[^/]+/.exec(file)?.[0] ?? ""
  const problems = []
  text.split("\n").forEach((line, index) => {
    const where = `${file}:${index + 1}`
    const filterDirs = [...line.matchAll(PNPM_RUN)].flatMap(
      ([, options]) => selectedPackages(options, deps).dirs
    )

    for (const [match] of line.matchAll(SCRIPT_PATH)) {
      const ref = match.replace(/^\.\//, "")
      const excused = EXTERNAL.some(
        (entry) => entry.file === file && entry.ref === ref
      )
      if (!excused && !resolves(ref, [skill, ""], deps))
        problems.push(
          `${where} names ${match}, which is not in this skill or the repo. Point it at the file that exists now, or delete it.`
        )
    }

    for (const [match] of line.matchAll(BARE_SCRIPT)) {
      const dirs = [skill, path.posix.join(skill, "scripts"), "", "scripts"]
      if (!resolves(match, [...dirs, ...filterDirs], deps))
        problems.push(
          `${where} names ${match} with no folder, and no file of that name is in this skill, its scripts, the repo or the package it filters. Give the full path.`
        )
    }

    for (const pattern of [LINE_WORD_REF, COLON_REF])
      for (const [match, ref, first, last] of line.matchAll(pattern)) {
        const length = deps.lineCount(ref)
        const cited = Math.max(Number(first), Number(last ?? first))
        if (length !== null && cited > length)
          problems.push(
            `${where} cites ${match}, but ${ref} has only ${length} lines. Point at a function or test name instead of a line number.`
          )
      }

    for (const [, options, name] of line.matchAll(PNPM_RUN)) {
      if (BUILTIN.has(name)) continue
      const { dirs, unknown, checkable } = selectedPackages(options, deps)
      for (const filter of unknown)
        problems.push(
          `${where} filters to ${filter}, which is not a workspace package`
        )
      if (!checkable || unknown.length > 0) continue
      const selected = options.trim()
      if (!selected) dirs.push("")
      if (dirs.some((dir) => deps.scripts(dir).has(name))) continue
      const scriptFiles = dirs
        .map((dir) => `${dir || "."}/package.json`)
        .join(" or ")
      problems.push(
        `${where} runs pnpm ${selected ? `${selected} ` : ""}${name}, which is not a script in ${scriptFiles}`
      )
    }
  })
  return problems
}
