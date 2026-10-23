// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const srcDir = path.join(webRoot, "src")
const thisFile = fileURLToPath(import.meta.url)

const PALETTE_HUES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const

const PALETTE_UTILITIES =
  "bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|accent|shadow|caret|divide|placeholder|ring-offset"

const HEX_RE =
  /(?:-\[#[0-9A-Fa-f]{3,8}\]|["'`]#[0-9A-Fa-f]{3,8}["'`]|#[0-9A-Fa-f]{6,8}\b)/g

const PALETTE_RE = new RegExp(
  `(?<![\\w-])(?:${PALETTE_UTILITIES})-(?:${PALETTE_HUES.join("|")})-(?:\\d{2,3})(?:/\\d{1,3})?\\b`,
  "g"
)

const RAW_INTERACTIVE_RE = /<(button|input|textarea|select)\b/g

/**
 * App-source files allowed to contain raw hex or named Tailwind palette
 * classes. Each path MUST have a `//` reason on the previous line — adding
 * a path without that comment fails this file's own contract.
 *
 * The two documented exceptions (ADR-0010):
 * 1. CV print paper — hex may live in the template file below.
 * 2. Tokenized GitHub heatmap ramp — hex lives in the kit stylesheet, not
 *    app code, so it does not appear here.
 */
const VOCABULARY_ALLOWLIST = [
  // CV print paper — documented ADR-0010 exception (print layout; paper is white).
  "features/paper/paper-cv-document.tsx",
] as const

/**
 * Feature files allowed to host a raw interactive element. Each path MUST
 * have a `//` reason on the previous line. The element itself must sit
 * under a `Documented exception` comment in the feature file.
 */
const RAW_INTERACTIVE_ALLOWLIST = [
  // Hidden file pickers — kit Input cannot host type="file".
  "features/paper/paper-cv-document.tsx",
  // Hidden file pickers — kit Input cannot host type="file".
  "features/paper/paper-editor.tsx",
  // Hidden file pickers — kit Input cannot host type="file".
  "features/paper/paper-proof-document.tsx",
] as const

function appSourceFiles() {
  return readdirSync(srcDir, { recursive: true, encoding: "utf8" }).filter(
    (file) =>
      /\.(tsx?|css)$/.test(file) &&
      !file.includes(".test.") &&
      !file.startsWith("test/")
  )
}

function rel(file: string) {
  return file.replaceAll("\\", "/")
}

function hits(source: string, pattern: RegExp) {
  return source.match(pattern) ?? []
}

function requireCommentedAllowlist(entries: readonly string[], label: string) {
  const source = readFileSync(thisFile, "utf8")
  for (const entry of entries) {
    const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const justified = new RegExp(`//[^\\n]+\\n\\s*["']${escaped}["']`)
    expect(
      justified.test(source),
      `${label} allowlist entry "${entry}" needs a // reason on the previous line`
    ).toBe(true)
  }
}

describe("design-system vocabulary", () => {
  it("justifies every vocabulary allowlist entry with a comment", () => {
    requireCommentedAllowlist(VOCABULARY_ALLOWLIST, "vocabulary")
  })

  it("forbids raw hex and named Tailwind palette classes outside the allowlist", () => {
    const allowed = new Set<string>(VOCABULARY_ALLOWLIST)
    const violations: string[] = []

    for (const file of appSourceFiles()) {
      if (allowed.has(rel(file))) continue
      const source = readFileSync(path.join(srcDir, file), "utf8")
      const hex = hits(source, HEX_RE)
      const palette = hits(source, PALETTE_RE)
      if (hex.length === 0 && palette.length === 0) continue
      violations.push(`${rel(file)}: ${[...hex, ...palette].join(", ")}`)
    }

    expect(violations, violations.join("\n")).toEqual([])
  })
})

describe("design-system adoption", () => {
  it("justifies every raw-interactive allowlist entry with a comment", () => {
    requireCommentedAllowlist(RAW_INTERACTIVE_ALLOWLIST, "raw-interactive")
  })

  it("keeps raw button/input/textarea/select out of feature files", () => {
    const allowed = new Set<string>(RAW_INTERACTIVE_ALLOWLIST)
    const violations: string[] = []
    const featureFiles = appSourceFiles().filter(
      (file) => rel(file).startsWith("features/") && file.endsWith(".tsx")
    )

    for (const file of featureFiles) {
      const source = readFileSync(path.join(srcDir, file), "utf8")
      const tags = hits(source, RAW_INTERACTIVE_RE)
      if (tags.length === 0) continue

      if (!allowed.has(rel(file))) {
        violations.push(`${rel(file)}: ${tags.join(", ")}`)
        continue
      }

      const lines = source.split("\n")
      lines.forEach((line, index) => {
        if (!RAW_INTERACTIVE_RE.test(line)) return
        RAW_INTERACTIVE_RE.lastIndex = 0
        const window = lines.slice(Math.max(0, index - 4), index + 1).join("\n")
        if (!/Documented exception/i.test(window)) {
          violations.push(
            `${rel(file)}:${index + 1} raw <${line.match(RAW_INTERACTIVE_RE)?.[1]}> without a nearby Documented exception comment`
          )
        }
      })
    }

    expect(violations, violations.join("\n")).toEqual([])
  })
})
