import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const posix = path.posix
const repoRoot = fileURLToPath(new URL("../..", import.meta.url))

export const TEST_FILE = /^(?:apps|packages)\/[^/]+\/.+\.test\.[cm]?[jt]sx?$/

const LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`([^`]*)`/g
const LEADING_INTERPOLATION = /^\$\{[^}]*\}\//
const GLOB_SEGMENT = /[*?{[]/
const HAS_EXTENSION = /\.[\w-]+$/

export const packageOf = (file) => file.split("/").slice(0, 2).join("/")

const isInside = (child, parent) =>
  child === parent || child.startsWith(`${parent}/`)

function stripGlob(candidate) {
  const segments = candidate.split("/")
  const at = segments.findIndex((segment) => GLOB_SEGMENT.test(segment))
  return (at < 0 ? segments : segments.slice(0, at)).join("/")
}

function literals(text) {
  const found = []
  for (const match of text.matchAll(LITERAL)) {
    const value = match[1] ?? match[2] ?? match[3]
    if (value) found.push(value.replace(LEADING_INTERPOLATION, ""))
  }
  return found
}

export function outsideReads(text, file, topLevel) {
  const own = packageOf(file)
  const dir = posix.dirname(file)
  const reads = new Set()
  for (const value of literals(text)) {
    if (value.includes("${") || /[\s\\]/.test(value)) continue
    let target = null
    if (value.startsWith("./") || value.startsWith("../")) {
      const resolved = posix.normalize(posix.join(dir, value))
      if (resolved.startsWith("..")) continue
      target = resolved
    } else if (
      topLevel.has(value.split("/")[0]) &&
      value.split("/")[0] !== "node_modules" &&
      value.includes("/")
    ) {
      target = posix.normalize(value)
    }
    if (!target) continue
    target = stripGlob(target).replace(/\/$/, "")
    if (!target || target === ".") continue
    if (isInside(own, target)) continue
    if (isInside(target, own)) continue
    reads.add(target)
  }
  return [...reads].sort()
}

function globToRegExp(glob) {
  let source = ""
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    if (char === "*" && glob[i + 1] === "*") {
      source += glob[i + 2] === "/" ? "(?:.*/)?" : ".*"
      i += glob[i + 2] === "/" ? 2 : 1
    } else if (char === "*") source += "[^/]*"
    else if (char === "?") source += "[^/]"
    else source += char.replace(/[.+^$()|[\]{}\\]/g, "\\$&")
  }
  return new RegExp(`^${source}$`)
}

function rootRelative(input, pkgDir) {
  if (input === "$TURBO_DEFAULT$") return `${pkgDir}/**`
  if (input.startsWith("$TURBO_ROOT$/")) return input.slice(13)
  return posix.normalize(posix.join(pkgDir, input))
}

const parseJson = (text) => (typeof text === "string" ? JSON.parse(text) : null)

export function declaredTestInputs(pkgDir, read, task = "test") {
  const rootTurbo = parseJson(read("turbo.json")) ?? {}
  const pkgTurbo = parseJson(read(`${pkgDir}/turbo.json`)) ?? {}
  const pkg = parseJson(read(`${pkgDir}/package.json`)) ?? {}
  const inputs = pkgTurbo.tasks?.[task]?.inputs ??
    rootTurbo.tasks?.[`${pkg.name}#${task}`]?.inputs ??
    rootTurbo.tasks?.[task]?.inputs ?? ["$TURBO_DEFAULT$"]
  const globs = [
    ...inputs.map((input) =>
      input.startsWith("!")
        ? `!${rootRelative(input.slice(1), pkgDir)}`
        : rootRelative(input, pkgDir)
    ),
    ...(rootTurbo.globalDependencies ?? []),
  ]
  return {
    include: globs.filter((glob) => !glob.startsWith("!")).map(globToRegExp),
    exclude: globs
      .filter((glob) => glob.startsWith("!"))
      .map((glob) => globToRegExp(glob.slice(1))),
  }
}

const dirOfPackageName = (name) =>
  name.startsWith("@workspace/") ? `packages/${name.slice(11)}` : `apps/${name}`

export function dependencyPackages(pkgDir, read, seen = new Set()) {
  const pkg = parseJson(read(`${pkgDir}/package.json`))
  if (!pkg) return seen
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  for (const name of names) {
    const dir = dirOfPackageName(name)
    if (seen.has(dir)) continue
    if (parseJson(read(`${dir}/package.json`))?.name !== name) continue
    seen.add(dir)
    dependencyPackages(dir, read, seen)
  }
  return seen
}

const CODE_FILE = /\.[cm]?[jt]sx?$/
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"]
const RELATIVE_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.\.?\/[^"']+)["']/g

const probesFor = (target) =>
  HAS_EXTENSION.test(target)
    ? [target]
    : [
        `${target}/declared-input-probe/file.ts`,
        ...SOURCE_EXTENSIONS.map((extension) => `${target}${extension}`),
      ]

export function isDeclared(target, declared, dependencies) {
  if ([...dependencies].some((dir) => isInside(target, dir))) return true
  return probesFor(target).some(
    (probe) =>
      declared.include.some((glob) => glob.test(probe)) &&
      !declared.exclude.some((glob) => glob.test(probe))
  )
}

function resolveSource(specifier, fromFile, read) {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), specifier))
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.js$/, ".tsx"),
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ]
  return candidates.find((candidate) => read(candidate) !== null) ?? null
}

export function importedSources(start, read, stopAt) {
  const seen = new Set()
  const queue = [start]
  while (queue.length) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    const text = read(file)
    if (text === null) continue
    for (const match of text.matchAll(RELATIVE_IMPORT)) {
      const next = resolveSource(match[1], file, read)
      if (next && !stopAt(next) && !seen.has(next)) queue.push(next)
    }
  }
  seen.delete(start)
  return [...seen].sort()
}

export const testTaskOf = (file) =>
  /\.formal\.test\./.test(file) ? "test:formal" : "test"

const workingTree = {
  read(rel) {
    const file = path.join(repoRoot, rel)
    return existsSync(file) ? readFileSync(file, "utf8") : null
  },
}

export const repoTopLevel = () => new Set(readdirSync(repoRoot))

export function detect(
  text,
  file,
  io = workingTree,
  topLevel = repoTopLevel()
) {
  if (!TEST_FILE.test(file)) return []
  const pkgDir = packageOf(file)
  const task = testTaskOf(file)
  const declared = declaredTestInputs(pkgDir, io.read, task)
  const dependencies = dependencyPackages(pkgDir, io.read)
  const covered = (target) =>
    isInside(target, pkgDir) || isDeclared(target, declared, dependencies)
  const direct = outsideReads(text, file, topLevel)
  const reached = new Set(direct)
  for (const target of direct)
    if (CODE_FILE.test(target))
      for (const source of importedSources(target, io.read, covered))
        reached.add(source)
  return [...reached]
    .sort()
    .filter((target) => !covered(target))
    .map((target) => ({
      file,
      target,
      text: `${file} reads ${target}, which is outside ${pkgDir} and not an input of its ${task} task. Add "$TURBO_ROOT$/${target}${HAS_EXTENSION.test(target) ? "" : "/**"}" to tasks["${task}"].inputs in ${pkgDir}/turbo.json`,
    }))
}
