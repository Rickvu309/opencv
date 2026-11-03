#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { stripComments } from "./lib/strip-comments.mjs"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..")
const roots = [
  "apps/web/src",
  "packages/ui/src/components",
  "packages/ui/src/hooks",
  "packages/ui/src/lib",
]
const skip = new Set([
  "apps/web/src/test/design-vocabulary.test.ts",
  "apps/web/src/test/ui-kit-contract.test.ts",
])
const cls = (name) => `(?<![\\w-])${name}(?![\\w-])`
const tok = (name) => new RegExp(cls(name), "g")

const rules = [
  ["text-page-title -> text-3xl", tok("text-page-title"), "text-3xl"],
  ["text-section-title -> text-xl", tok("text-section-title"), "text-xl"],
  ["text-body -> text-sm", tok("text-body"), "text-sm"],
  ["text-label -> text-xs", tok("text-label"), "text-xs"],
  ["text-(3xs|2xs|micro) -> text-xs", tok("text-(?:3xs|2xs|micro)"), "text-xs"],
  [
    "font-heading -> (dropped)",
    new RegExp(` ${cls("font-heading")}|${cls("font-heading")} ?`, "g"),
    "",
  ],
  [
    "ease-(standard|emphasized) -> ease-micro",
    tok("ease-(?:standard|emphasized)"),
    "ease-micro",
  ],
  [
    "--ease-(standard|emphasized) -> --ease-micro",
    /--ease-(?:standard|emphasized)(?![\w-])/g,
    "--ease-micro",
  ],
  [
    "duration-(base|fast|micro) -> duration-(--duration-micro)",
    tok("duration-(?:base|fast|micro)"),
    "duration-(--duration-micro)",
  ],
  [
    "--duration-(base|fast) -> --duration-micro",
    /--duration-(?:base|fast)(?![\w-])/g,
    "--duration-micro",
  ],
  [
    "duration-(slow|panel) -> duration-(--duration-panel)",
    tok("duration-(?:slow|panel)"),
    "duration-(--duration-panel)",
  ],
  [
    "--duration-slow -> --duration-panel",
    /--duration-slow(?![\w-])/g,
    "--duration-panel",
  ],
  [
    "duration-(75|100|150|200) -> duration-(--duration-micro)",
    tok("duration-(?:75|100|150|200)"),
    "duration-(--duration-micro)",
  ],
  [
    "duration-(300|500) -> duration-(--duration-panel)",
    tok("duration-(?:300|500)"),
    "duration-(--duration-panel)",
  ],
  [
    "z-(popover|overlay|modal|dropdown) -> z-50",
    tok("z-(?:popover|overlay|modal|dropdown)"),
    "z-50",
  ],
  ["z-sticky -> z-40", tok("z-sticky"), "z-40"],
]

export function rewriteSource(file, source, onHit = () => {}, strip = true) {
  let next = strip ? stripComments(file, source) : source
  for (const [name, pattern, replacement] of rules) {
    next = next.replace(pattern, () => {
      onHit(name)
      return replacement
    })
  }
  return next
}

function walk(dir, out = []) {
  for (const entry of readdirSync(path.join(repoRoot, dir), {
    withFileTypes: true,
  })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx|css)$/.test(entry.name) && !skip.has(rel)) out.push(rel)
  }
  return out
}

function installedFiles() {
  const listed = execFileSync(
    "git",
    ["ls-files", "--modified", "--others", "--exclude-standard"],
    { cwd: repoRoot, encoding: "utf8" }
  )
  return new Set(listed.split("\n").filter(Boolean))
}

function main() {
  const installed = installedFiles()
  const dryRun = process.argv.includes("--dry-run")
  const counts = new Map(rules.map(([name]) => [name, 0]))
  const changed = new Set()

  for (const file of roots.flatMap((root) => walk(root))) {
    const full = path.join(repoRoot, file)
    const original = readFileSync(full, "utf8")
    const source = rewriteSource(
      file,
      original,
      (name) => counts.set(name, counts.get(name) + 1),
      installed.has(file)
    )
    if (source === original) continue
    changed.add(file)
    if (!dryRun) writeFileSync(full, source)
  }

  for (const [name, count] of counts)
    console.log(`${String(count).padStart(4)}  ${name}`)
  console.log(`${dryRun ? "would change" : "changed"} ${changed.size} files`)
  if (dryRun) for (const file of [...changed].sort()) console.log(`  ${file}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
