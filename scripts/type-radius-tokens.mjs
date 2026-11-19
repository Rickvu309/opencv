#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..")
export const ROOTS = ["apps/web/src", "packages/ui/src"]
export const RATCHET_FILE = "scripts/type-radius-tokens.ratchet.json"

export const TYPE_TOKENS = { "13px": "text-ui", "12.5px": "text-xs" }

export const RADIUS_TOKENS = {
  "2px": "xs",
  "5px": "sm",
  "6px": "sm",
  "7px": "md",
  "8px": "md",
  "10px": "lg",
  "11px": "lg",
  "12px": "lg",
  "13px": "xl",
  "14px": "xl",
  "18px": "2xl",
}

export const TYPE_SCALE =
  "text-xs 12px, text-ui 13px, text-sm 14px, text-base 16px, text-lg 18px, text-xl 20px"
export const RADIUS_SCALE =
  "rounded-xs 2px, rounded-sm 6px, rounded-md 8px, rounded-lg 10px, rounded-xl 14px, rounded-2xl 18px"

const TYPE_LITERAL = /(?<![\w-])text-\[(\d+(?:\.\d+)?(?:px|rem))\]/g
const RADIUS_LITERAL =
  /(?<![\w-])(rounded(?:-(?:tl|tr|br|bl|ss|se|es|ee|t|r|b|l|s|e))?)-\[(\d+(?:\.\d+)?px)\]/g
const BARE_CN_IMPORT = /import\s*\{[^}]*\bcn\b[^}]*\}\s*from\s*["']cn["']/
const KIT_TYPE_TOKEN = /(?<![\w-])text-ui(?![\w-])/

const lineAt = (source, index) => source.slice(0, index).split("\n").length

function typeHit(match) {
  const token = TYPE_TOKENS[match[1]] ?? null
  return {
    literal: match[0],
    token,
    hint: token
      ? `use ${token}`
      : `use a type size from the scale (${TYPE_SCALE})`,
  }
}

function radiusHit(match) {
  const size = RADIUS_TOKENS[match[2]]
  const token = size ? `${match[1]}-${size}` : null
  return {
    literal: match[0],
    token,
    hint: token ? `use ${token}` : `use a radius token (${RADIUS_SCALE})`,
  }
}

export function detect(source) {
  return [
    ...[...source.matchAll(TYPE_LITERAL)].map((match) => ({
      line: lineAt(source, match.index),
      ...typeHit(match),
    })),
    ...[...source.matchAll(RADIUS_LITERAL)].map((match) => ({
      line: lineAt(source, match.index),
      ...radiusHit(match),
    })),
  ].sort((a, b) => a.line - b.line)
}

export function dropsKitTypeToken(source) {
  return KIT_TYPE_TOKEN.test(source) && BARE_CN_IMPORT.test(source)
}

export function migrate(source) {
  const moved = source
    .replace(TYPE_LITERAL, (literal, size) => TYPE_TOKENS[size] ?? literal)
    .replace(RADIUS_LITERAL, (literal, utility, size) =>
      RADIUS_TOKENS[size] ? `${utility}-${RADIUS_TOKENS[size]}` : literal
    )
  return dropsKitTypeToken(moved)
    ? moved.replace(BARE_CN_IMPORT, (statement) =>
        statement.replace(/["']cn["']/, '"@workspace/ui/lib/utils"')
      )
    : moved
}

const isTest = (file) => /\.test\.[jt]sx?$/.test(file)

export function trackedSources(roots = ROOTS) {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", ...roots],
    { cwd: repoRoot, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)))
}

export function offScaleCounts() {
  return Object.fromEntries(
    trackedSources()
      .filter((file) => !isTest(file))
      .map((file) => [
        file,
        detect(readFileSync(path.join(repoRoot, file), "utf8")).length,
      ])
      .filter(([, count]) => count > 0)
  )
}

function writeRatchet() {
  const counts = offScaleCounts()
  writeFileSync(
    path.join(repoRoot, RATCHET_FILE),
    `${JSON.stringify(counts, Object.keys(counts).sort(), 2)}\n`
  )
  console.log(
    `${RATCHET_FILE}: ${Object.values(counts).reduce((a, b) => a + b, 0)} literal(s) left in ${Object.keys(counts).length} file(s)`
  )
}

function main(argv) {
  if (argv.includes("--ratchet")) return writeRatchet()
  const write = argv.includes("--write")
  const roots = argv.filter((arg) => !arg.startsWith("--"))
  const changed = []
  let moved = 0
  for (const file of trackedSources(roots.length > 0 ? roots : ROOTS)) {
    const full = path.join(repoRoot, file)
    const before = readFileSync(full, "utf8")
    const after = migrate(before)
    if (after === before) continue
    moved += detect(before).length - detect(after).length
    changed.push(file)
    if (write) writeFileSync(full, after)
  }
  console.log(
    `${write ? "moved" : "would move"} ${moved} literal(s) in ${changed.length} file(s)`
  )
  for (const file of changed) console.log(`  ${file}`)
  if (!write) return
  if (changed.length > 0)
    execFileSync("pnpm", ["exec", "prettier", "--write", ...changed], {
      cwd: repoRoot,
      stdio: "ignore",
      timeout: 120_000,
    })
  writeRatchet()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2))
