import { createRequire } from "node:module"
import { posix } from "node:path"
import { UnreadableGitOutput } from "./git-reads.mjs"

const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/
const NEVER_RUN = /\.type-test\.ts$/
const PACKAGE_JSON = /^((?:[^/]+\/)+?)package\.json$/

export const SCRIPTS_RUNNER = Object.freeze({
  name: "scripts",
  root: "scripts/",
  dir: "",
  cmd: "node",
  args: ["--test", "--test-reporter=dot"],
  source: "scripts/",
  pkg: null,
})

export function workspaceGlobs(yamlText) {
  const globs = []
  let inPackages = false
  for (const line of String(yamlText ?? "").split("\n")) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true
      continue
    }
    if (inPackages && /^\S/.test(line)) inPackages = false
    if (!inPackages || /^\s*(?:#.*)?$/.test(line)) continue
    const item = line.match(/^\s+-\s+(["']?)([^"'#\s!]+)\1\s*(?:#.*)?$/)
    if (!item)
      throw new UnreadableGitOutput(
        `pnpm-workspace.yaml has a packages line the tool does not read: ${JSON.stringify(line.trim())}; list each package glob as - "dir/*"`
      )
    globs.push(item[2])
  }
  return globs
}

const globPattern = (glob) =>
  new RegExp(
    `^${glob
      .replace(/\/+$/, "")
      .split("/")
      .map((part) =>
        part === "*"
          ? "[^/]+"
          : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")
      )
      .join("/")}$`
  )

export function workspacePackageDirs(globs, paths) {
  const patterns = globs.map(globPattern)
  const dirs = new Set()
  for (const path of paths) {
    const match = path.match(PACKAGE_JSON)
    if (!match) continue
    const dir = match[1].slice(0, -1)
    if (patterns.some((p) => p.test(dir))) dirs.add(dir)
  }
  return [...dirs].sort()
}

const words = (script) => String(script).trim().split(/\s+/)

function vitestRunner(dir, parts) {
  return {
    cmd: `${dir}/node_modules/.bin/vitest`,
    args: [...parts.slice(1), "--maxWorkers=2", "--allowOnly=false"],
    root: `${dir}/`,
    source: `${dir}/src/`,
  }
}

function nodeTestRunner(dir, parts) {
  const glob = parts.find((part, i) => i > 0 && TEST_FILE.test(part))
  if (!glob) return null
  const folder = posix.dirname(glob)
  const base = folder === "." ? `${dir}/` : `${dir}/${folder}/`
  return {
    cmd: "node",
    args: [
      ...parts.slice(1).filter((part) => part !== glob),
      "--test-reporter=dot",
    ],
    root: base,
    flat: !glob.includes("**"),
    source: `${dir}/src/`,
  }
}

function nodeScriptRunner(dir) {
  return {
    cmd: "node",
    args: ["--test", "--test-reporter=dot"],
    root: `${dir}/`,
    flat: true,
    source: `${dir}/`,
  }
}

export function runnerFor(dir, testScript) {
  if (!testScript) return null
  const parts = words(testScript)
  if (parts[0] === "vitest" && parts[1] === "run")
    return vitestRunner(dir, parts)
  if (parts[0] === "node" && parts.includes("--test"))
    return nodeTestRunner(dir, parts)
  if (parts[0] === "node" && parts.length === 2 && /\.mjs$/.test(parts[1]))
    return nodeScriptRunner(dir)
  return null
}

export function workspaceRunners({ workspaceYaml, packageJsons }) {
  const globs = workspaceGlobs(workspaceYaml)
  if (!globs.length)
    throw new UnreadableGitOutput(
      "pnpm-workspace.yaml lists no packages the tool can read, so no test runner can be found; restore its packages list"
    )
  const dirs = workspacePackageDirs(globs, [...packageJsons.keys()])
  const packages = dirs.map((dir) => {
    let json
    try {
      json = JSON.parse(packageJsons.get(`${dir}/package.json`))
    } catch (error) {
      throw new UnreadableGitOutput(
        `${dir}/package.json is not valid JSON (${error.message}), so its test runner cannot be read; fix it and run pnpm install`
      )
    }
    if (!json || typeof json !== "object" || Array.isArray(json))
      throw new UnreadableGitOutput(
        `${dir}/package.json is not a JSON object, so its test runner cannot be read; fix it`
      )
    const testScript = json.scripts?.test ?? null
    const shape = runnerFor(dir, testScript)
    return {
      dir,
      name: json.name ?? dir,
      testScript,
      runner: shape
        ? { name: dir, dir, pkg: json.name ?? dir, ...shape }
        : null,
    }
  })
  const runners = [
    ...packages.flatMap((pkg) => (pkg.runner ? [pkg.runner] : [])),
    SCRIPTS_RUNNER,
  ].sort((a, b) => b.root.length - a.root.length)
  return { packages, runners }
}

export function runnerOf(file, runners) {
  for (const runner of runners) {
    if (!file.startsWith(runner.root)) continue
    if (runner.flat && file.slice(runner.root.length).includes("/")) continue
    return runner
  }
  return null
}

export const isTestFile = (file) =>
  TEST_FILE.test(file) && !NEVER_RUN.test(file)

export const isRunnableTest = (file, runners) =>
  isTestFile(file) && !!runnerOf(file, runners)

export function packageOf(file, packages) {
  return (
    packages
      .filter((pkg) => file.startsWith(`${pkg.dir}/`))
      .sort((a, b) => b.dir.length - a.dir.length)[0] ?? null
  )
}

const FOCUS_APIS = new Set(["test", "it", "describe", "suite", "bench"])

function loadTypeScript() {
  try {
    return createRequire(import.meta.url)("typescript")
  } catch (error) {
    throw new UnreadableGitOutput(
      `the TypeScript parser could not be loaded (${error.message}), so changed tests cannot be read for .only; run pnpm install`
    )
  }
}

function rootName(ts, node) {
  let at = node
  while (
    ts.isPropertyAccessExpression(at) ||
    ts.isCallExpression(at) ||
    ts.isElementAccessExpression(at)
  )
    at = at.expression
  return ts.isIdentifier(at) ? at.text : null
}

export function focusedCalls(file, text) {
  const ts = loadTypeScript()
  const kind = /\.tsx$/.test(file)
    ? ts.ScriptKind.TSX
    : /\.[cm]?ts$/.test(file)
      ? ts.ScriptKind.TS
      : /\.jsx$/.test(file)
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.JS
  const source = ts.createSourceFile(
    file,
    String(text),
    ts.ScriptTarget.Latest,
    true,
    kind
  )
  const found = []
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "only" &&
      FOCUS_APIS.has(rootName(ts, node.expression))
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      found.push({
        line: line + 1,
        call: node.getText(source).replace(/\s+/g, ""),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
