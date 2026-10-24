#!/usr/bin/env node
// Tailwind has no `duration-micro` utility (its theme key is --transition-duration),
// so durations use the variable shorthand `duration-(--duration-micro)`.
// Rewrites OpenPath-era design-system names to stock Tailwind and shadcn names.
// Re-runnable: run it with --dry-run after every `shadcn add`; each rule prints
// its hit count and the rewrite is a no-op once every count is 0.
//
//   node scripts/ds-codemod.mjs --dry-run   count hits, write nothing
//   node scripts/ds-codemod.mjs             rewrite files in place
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..")
const roots = ["apps/web/src", "packages/ui/src/components"]
const skip = new Set([
  "apps/web/src/test/design-vocabulary.test.ts",
  "apps/web/src/test/ui-kit-contract.test.ts",
])
const dryRun = process.argv.includes("--dry-run")

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

const counts = new Map(rules.map(([name]) => [name, 0]))
const changed = new Set()

for (const file of roots.flatMap((root) => walk(root))) {
  const full = path.join(repoRoot, file)
  let source = readFileSync(full, "utf8")
  const original = source
  for (const [name, pattern, replacement] of rules) {
    source = source.replace(pattern, () => {
      counts.set(name, counts.get(name) + 1)
      changed.add(file)
      return replacement
    })
  }
  if (!dryRun && source !== original) writeFileSync(full, source)
}

for (const [name, count] of counts)
  console.log(`${String(count).padStart(4)}  ${name}`)
console.log(`${dryRun ? "would change" : "changed"} ${changed.size} files`)
if (dryRun) for (const file of [...changed].sort()) console.log(`  ${file}`)
