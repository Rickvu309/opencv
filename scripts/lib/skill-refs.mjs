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
  /\bpnpm[ \t]+(?:(?:-F|--filter)[ \t]+(\S+)[ \t]+)?([A-Za-z][\w:.-]*)/g
const PACKAGE_TOKEN = /^[@\w./-]+(?:\.\.\.)?$/

const trimmedScope = (filter) => filter.replace(/\.\.\.$/, "")

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
  }
}

const resolves = (ref, dirs, deps) =>
  dirs.some((dir) => deps.exists(path.posix.join(dir, ref)))

export function detect(text, file, deps = repoDeps()) {
  const skill = /^\.claude\/skills\/[^/]+/.exec(file)?.[0] ?? ""
  const problems = []
  text.split("\n").forEach((line, index) => {
    const where = `${file}:${index + 1}`
    const filterDirs = [...line.matchAll(PNPM_RUN)]
      .map(([, filter]) => filter)
      .filter((filter) => filter && PACKAGE_TOKEN.test(filter))
      .map((filter) => deps.packageDir(trimmedScope(filter)))
      .filter(Boolean)

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

    for (const [, filter, name] of line.matchAll(PNPM_RUN)) {
      if (BUILTIN.has(name) || (filter && !PACKAGE_TOKEN.test(filter))) continue
      if (!filter) {
        if (!deps.scripts("").has(name))
          problems.push(
            `${where} runs pnpm ${name}, which is not a script in the root package.json`
          )
        continue
      }
      const dir = deps.packageDir(trimmedScope(filter))
      if (!dir)
        problems.push(
          `${where} filters to ${filter}, which is not a workspace package`
        )
      else if (!deps.scripts(dir).has(name))
        problems.push(
          `${where} runs pnpm --filter ${filter} ${name}, which is not a script in ${dir}/package.json`
        )
    }
  })
  return problems
}
