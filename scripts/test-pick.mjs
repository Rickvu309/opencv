import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { changeMap, readChangeGraph } from "./change-map.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

export const DEFAULT_BUDGET_SECONDS = 120
export const UNKNOWN_TEST_SECONDS = 2

const APP_PARTS = Object.freeze({ api: "apps/api", web: "apps/web" })
const TEST_FILE = /\.test\.tsx?$/

export function workspaceOf(file) {
  const match = file.match(/^((?:apps|packages)\/[^/]+)\//)
  return match ? match[1] : null
}

export function packOf(file, packDirs) {
  return (
    packDirs
      .filter((dir) => file.startsWith(`${dir}/`))
      .sort((a, b) => b.length - a.length)[0] ?? workspaceOf(file)
  )
}

function dependentsOf(start, edges) {
  const reached = new Set(start)
  let grew = true
  while (grew) {
    grew = false
    for (const [from, to] of edges)
      if (reached.has(to) && !reached.has(from)) {
        reached.add(from)
        grew = true
      }
  }
  return reached
}

function workspacesReached(changed, world) {
  const map = changeMap(changed, world.graph)
  const start = new Set(changed.map(workspaceOf).filter(Boolean))
  for (const part of map.parts) if (APP_PARTS[part]) start.add(APP_PARTS[part])
  if (map.reason) for (const dir of world.workspaces) start.add(dir)
  return { reached: dependentsOf(start, world.workspaceEdges), map }
}

export function pickTests(changed, world, budget = DEFAULT_BUDGET_SECONDS) {
  const packDirs = world.packs.map((pack) => pack.dir)
  const { reached: workspaces, map } = workspacesReached(changed, world)
  const changedPacks = new Set(
    map.reason
      ? []
      : changed
          .filter((file) => workspaceOf(file))
          .map((file) => packOf(file, packDirs))
  )
  const packEdges = world.packs.flatMap((pack) =>
    pack.dependencies.map((dep) => [pack.dir, dep])
  )
  const dependentPacks = dependentsOf(changedPacks, packEdges)
  const changedWorkspaces = new Set(changed.map(workspaceOf))
  const tierOf = (file) => {
    const pack = packOf(file, packDirs)
    const workspace = workspaceOf(file)
    if (changedPacks.has(pack)) return 0
    if (dependentPacks.has(pack)) return 1
    if (changedWorkspaces.has(workspace)) return 2
    return workspaces.has(workspace) ? 3 : null
  }
  const seconds = (file) => world.seconds[file] ?? UNKNOWN_TEST_SECONDS
  const reached = world.testFiles
    .map((file) => ({ file, tier: tierOf(file), seconds: seconds(file) }))
    .filter((test) => test.tier !== null)
    .sort(
      (a, b) =>
        a.tier - b.tier || a.seconds - b.seconds || a.file.localeCompare(b.file)
    )
  const run = []
  const ciOnly = []
  let spent = 0
  for (const test of reached) {
    if (spent + test.seconds <= budget) {
      run.push(test.file)
      spent += test.seconds
    } else ciOnly.push(test.file)
  }
  return { run, ciOnly, seconds: spent, reason: map.reason }
}

export function commandsFor(files, testScripts) {
  const byWorkspace = new Map()
  for (const file of files) {
    const dir = workspaceOf(file)
    byWorkspace.set(dir, [...(byWorkspace.get(dir) ?? []), file])
  }
  return [...byWorkspace].map(([dir, list]) => {
    const script = (testScripts[dir] ?? "vitest run")
      .split(" ")
      .filter((word) => !word.includes("*"))
      .join(" ")
    const args = list.map((file) => file.slice(dir.length + 1)).join(" ")
    const runner = /^(node|npx) /.test(script) ? script : `npx ${script}`
    return `(cd ${dir} && ${runner} ${args})`
  })
}

function packDependencies(text) {
  const block = text.match(/dependencies:\s*\[([^\]]*)\]/)
  return block
    ? block[1]
        .split(",")
        .map((dep) => dep.trim())
        .filter(Boolean)
    : []
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
}

export function readWorld() {
  const tracked = git(["ls-files"])
  const workspaces = [...new Set(tracked.map(workspaceOf).filter(Boolean))]
    .filter((dir) => existsSync(path.join(root, dir, "package.json")))
    .sort()
  const pkgs = Object.fromEntries(
    workspaces.map((dir) => [
      dir,
      JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8")),
    ])
  )
  const dirOfName = new Map(workspaces.map((dir) => [pkgs[dir].name, dir]))
  const workspaceEdges = workspaces.flatMap((dir) =>
    Object.keys({ ...pkgs[dir].dependencies, ...pkgs[dir].devDependencies })
      .filter((name) => dirOfName.has(name))
      .map((name) => [dir, dirOfName.get(name)])
  )
  const packs = tracked
    .filter((file) => file.endsWith("/pack.yml"))
    .map((file) => ({
      dir: path.dirname(file),
      dependencies: packDependencies(
        readFileSync(path.join(root, file), "utf8")
      ),
    }))
  const secondsFile = path.join(root, "scripts", "test-seconds.json")
  return {
    graph: readChangeGraph(),
    workspaces,
    workspaceEdges,
    packs,
    testFiles: tracked.filter(
      (file) => TEST_FILE.test(file) && workspaceOf(file)
    ),
    seconds: existsSync(secondsFile)
      ? JSON.parse(readFileSync(secondsFile, "utf8"))
      : {},
    testScripts: Object.fromEntries(
      workspaces.map((dir) => [dir, pkgs[dir].scripts?.test ?? "vitest run"])
    ),
  }
}

function option(args, name, fallback) {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}

function main(args) {
  const base = option(args, "--base", "origin/main")
  const budget = Number(option(args, "--budget", DEFAULT_BUDGET_SECONDS))
  const changed = [
    ...new Set([
      ...git(["diff", "--name-only", `${base}...HEAD`]),
      ...git(["diff", "--name-only", "HEAD"]),
      ...git(["ls-files", "--others", "--exclude-standard"]),
    ]),
  ]
  const world = readWorld()
  const picked = pickTests(changed, world, budget)
  if (!picked.run.length && !picked.ciOnly.length) {
    console.log(`No test is reached by the change against ${base}.`)
    return 0
  }
  if (picked.reason)
    console.log(`Every workspace is reached: ${picked.reason}.`)
  for (const line of commandsFor(picked.run, world.testScripts))
    console.log(line)
  console.log(
    picked.ciOnly.length
      ? `${picked.run.length} test files fit ${budget}s (about ${Math.round(picked.seconds)}s). Only CI runs the other ${picked.ciOnly.length} reached test files.`
      : `${picked.run.length} test files fit ${budget}s (about ${Math.round(picked.seconds)}s). CI runs no other reached test file.`
  )
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2))
