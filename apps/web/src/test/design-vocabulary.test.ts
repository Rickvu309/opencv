// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const srcDir = path.join(webRoot, "src")
const thisFile = fileURLToPath(import.meta.url)
const uiDir = path.resolve(webRoot, "../../packages/ui/src")

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

const STOCK_COLOR_PAIRS = [
  "card",
  "popover",
  "primary",
  "secondary",
  "muted",
  "accent",
  "sidebar",
  "sidebar-primary",
  "sidebar-accent",
] as const

const STOCK_COLORS = [
  "background",
  "foreground",
  ...STOCK_COLOR_PAIRS.flatMap((name) => [name, `${name}-foreground`]),
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar-border",
  "sidebar-ring",
]

const STOCK_ROOT = [...STOCK_COLORS, "radius"]

const MOTION_TOKENS = [
  "duration-micro",
  "duration-panel",
  "ease-micro",
  "ease-panel",
]

/**
 * Variables read in app or kit code that are not design tokens: positioning
 * values Base UI sets at runtime, the radius scale derived from `--radius`,
 * and the three feature-local variables below. Each group needs a reason.
 */
const READABLE_VARIABLES = new Set<string>([
  ...STOCK_COLORS,
  ...MOTION_TOKENS,
  // Theme radius scale derived from --radius in globals.css.
  "radius-sm",
  "radius-md",
  "radius-lg",
  "radius-xl",
  "radius-2xl",
  "radius-3xl",
  "radius-4xl",
  // Set at runtime by Base UI popups and used by the stock kit files.
  "transform-origin",
  "available-height",
  "available-width",
  "anchor-width",
  "anchor-height",
  // Declared by the stock Card as an arbitrary property on itself.
  "card-spacing",
  // Theme font stacks the affectUI widgets inherit.
  "font-sans",
  "font-mono",
  // Landing hero fluid size, declared in features/landing/landing.css.
  "landing-h1-mobile",
  "landing-h1-desktop",
])

/** Widget-scoped variables inside the affectUI files, mapped to stock variables at their root. */
const UI_WIDGET_VARIABLE_RE = /^ui-(?:segc|tlc|tcc|mac)-/

/** CV print variables declared in paper.css, the documented exception. */
const CV_VARIABLE_RE = /^cv-/

/**
 * Variables an affectUI kit file declares inside its own injected stylesheet
 * and maps to stock variables there (segmented-control, filter-menu,
 * notification-stack, smart-recommendation, number-ticker).
 */
const AFFECT_VARIABLE_RE = /^ui-(?:seg|fm|ns|sr|nt)-/

/** Variables owned by legacy-overlay.css; the legacy allowlist governs their use. */
const LEGACY_VARIABLE_RE = /^(?:success|warning|pitch-tone|github-heatmap)/

const RETIRED_CLASS_RE = new RegExp(
  [
    "(?<![\\w-])text-(?:3xs|2xs|micro|page-title|section-title|body|label)(?![\\w-])",
    "(?<![\\w-])font-(?:heading)(?![\\w-])",
    "(?<![\\w-])ease-(?:standard|emphasized)(?![\\w-])",
    "(?<![\\w-])duration-(?:base|fast|slow|\\d+)(?![\\w-])",
    "(?<![\\w-])z-(?:raised|dropdown|sticky|overlay|modal|popover|toast|max)(?![\\w-])",
  ].join("|"),
  "g"
)

const LEGACY_TOKEN_RE =
  /(?<![\w-])(?:bg|text|border|ring|from|to|via|fill|stroke|outline)-(?:success|warning|info|pitch-tone-[a-z]+|github-heatmap-\d)(?:-foreground)?(?![\w-])|var\(--(?:success|warning|info|pitch-tone|github-heatmap)/g

const VARIABLE_READ_RE = /(?:var\(|[\w-]\()(--[a-zA-Z0-9-]+)/g

/**
 * App-source files allowed to contain raw hex or named Tailwind palette
 * classes. Each path MUST have a `//` reason on the previous line — adding
 * a path without that comment fails this file's own contract.
 *
 * The one documented exception (ADR-0014) is the CV print paper.
 */
const VOCABULARY_ALLOWLIST = [
  // CV print paper — documented ADR-0014 exception (print layout; paper is white).
  "features/paper/cv-templates/product.tsx",
] as const

/**
 * Files that still use a token from `legacy-overlay.css`. The list only
 * shrinks: an entry whose file no longer uses a legacy token fails, and a
 * file that uses one without an entry fails. Each path needs a `//` line
 * above it naming the PR that removes it.
 */
const LEGACY_OVERLAY_ALLOWLIST = [
  // DS-4b replaces the Published pill with a stock Badge.
  "features/pitch/pitch-edit-toolbar.tsx",
  // DS-4b swaps the heatmap for the Kibo contribution graph.
  "features/pitch/pitch-github-heatmap.tsx",
  // DS-4b drops the success dot for a stock Badge.
  "features/pitch/pitch-showcase.tsx",
  // DS-4b maps tones to stock surfaces.
  "features/pitch/pitch-types.ts",
  // DS-4b turns the status chips and banner into stock Badge and Alert.
  "features/pitch/pitch-workspace.tsx",
] as const

/**
 * Feature files allowed to host a raw interactive element. Each path MUST
 * have a `//` reason on the previous line. The element itself must sit
 * under a `Documented exception` comment in the feature file.
 */
const RAW_INTERACTIVE_ALLOWLIST = [
  // Hidden file pickers — kit Input cannot host type="file".
  "features/paper/cv-templates/cv-parts.tsx",
  // Hidden file pickers — kit Input cannot host type="file".
  "features/paper/paper-cv-surface.tsx",
  // Hidden file pickers — kit Input cannot host type="file".
  "features/paper/paper-proof-toolbar.tsx",
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

function kitSourceFiles() {
  return readdirSync(path.join(uiDir, "components"), { encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `components/${file}`)
}

function readApp(file: string) {
  return readFileSync(path.join(srcDir, file), "utf8")
}

function readKit(file: string) {
  return readFileSync(path.join(uiDir, file), "utf8")
}

/** Body of the first top-level `selector { ... }` block in a stylesheet. */
function cssBlock(css: string, selector: string) {
  const match = new RegExp(`^${selector} \\{\\n([\\s\\S]*?)^\\}`, "m").exec(css)
  expect(match, `${selector} block`).not.toBeNull()
  return match![1]
}

function declared(block: string) {
  return [...block.matchAll(/^\s*--([\w-]+):/gm)].map((match) => match[1])
}

/** Custom properties a file declares or sets itself, such as the sizing variables of a showpiece component. */
function localVariables(source: string) {
  return new Set(
    [...source.matchAll(/(?:^|[\s{;"'`(])--([\w-]+)(?=\s*[:{]|["'`])/gm)].map(
      (match) => match[1]
    )
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
      const source = readApp(file)
      const hex = hits(source, HEX_RE)
      const palette = hits(source, PALETTE_RE)
      if (hex.length === 0 && palette.length === 0) continue
      violations.push(`${rel(file)}: ${[...hex, ...palette].join(", ")}`)
    }

    expect(violations, violations.join("\n")).toEqual([])
  })

  it("forbids the retired class roots in app and kit code", () => {
    const violations: string[] = []
    const files = [
      ...appSourceFiles().map((file) => [file, readApp(file)] as const),
      ...kitSourceFiles().map((file) => [file, readKit(file)] as const),
    ]
    for (const [file, source] of files) {
      const found = hits(source, RETIRED_CLASS_RE)
      if (found.length > 0) violations.push(`${rel(file)}: ${found.join(", ")}`)
    }
    expect(violations, violations.join("\n")).toEqual([])
  })

  it("reads only stock variables, the motion tokens and documented runtime variables", () => {
    const violations: string[] = []
    const files = [
      ...appSourceFiles().map((file) => [file, readApp(file)] as const),
      ...kitSourceFiles().map((file) => [file, readKit(file)] as const),
    ]
    for (const [file, source] of files) {
      const local = localVariables(source)
      const unknown = [...source.matchAll(VARIABLE_READ_RE)]
        .map((match) => match[1].slice(2))
        .filter(
          (name) =>
            !READABLE_VARIABLES.has(name) &&
            !local.has(name) &&
            !CV_VARIABLE_RE.test(name) &&
            !AFFECT_VARIABLE_RE.test(name) &&
            !UI_WIDGET_VARIABLE_RE.test(name) &&
            !LEGACY_VARIABLE_RE.test(name) &&
            !name.startsWith("tw-")
        )
      if (unknown.length > 0) {
        violations.push(`${rel(file)}: ${[...new Set(unknown)].join(", ")}`)
      }
    }
    expect(violations, violations.join("\n")).toEqual([])
  })

  it("keeps globals.css to the stock variable set plus the motion tokens", () => {
    const css = readKit("styles/globals.css")
    expect(declared(cssBlock(css, ":root")).sort()).toEqual(
      [...STOCK_ROOT].sort()
    )
    expect(declared(cssBlock(css, "\\.dark")).sort()).toEqual(
      [...STOCK_COLORS].sort()
    )

    const theme = cssBlock(css, "@theme inline")
    const themeColors = declared(theme)
      .filter((name) => name.startsWith("color-"))
      .map((name) => name.slice("color-".length))
    expect(themeColors.sort()).toEqual([...STOCK_COLORS].sort())
    for (const token of MOTION_TOKENS) expect(declared(theme)).toContain(token)
    expect(theme).toMatch(/--duration-micro:\s*150ms/)
    expect(theme).toMatch(/--duration-panel:\s*280ms/)
    expect(theme).toMatch(/--ease-micro:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/)
    expect(theme).toMatch(/--ease-panel:\s*cubic-bezier\(0\.32, 0\.72, 0, 1\)/)
    expect(css).toContain("prefers-reduced-motion")
  })
})

describe("legacy overlay", () => {
  it("justifies every legacy allowlist entry with a comment", () => {
    requireCommentedAllowlist(LEGACY_OVERLAY_ALLOWLIST, "legacy overlay")
  })

  it("lists exactly the files that still use a legacy token", () => {
    const using = appSourceFiles()
      .filter((file) => hits(readApp(file), LEGACY_TOKEN_RE).length > 0)
      .map(rel)
      .sort()
    expect(using).toEqual([...LEGACY_OVERLAY_ALLOWLIST].sort())
  })

  it("declares only the legacy variables", () => {
    const css = readKit("styles/legacy-overlay.css")
    const names = [
      ...declared(cssBlock(css, ":root")),
      ...declared(cssBlock(css, "\\.dark")),
    ]
    const unknown = names.filter(
      (name) =>
        !/^(?:success|warning)(?:-foreground)?$/.test(name) &&
        !/^(?:pitch-tone|github-heatmap)-/.test(name)
    )
    expect(unknown).toEqual([])
  })
})

describe("chat library", () => {
  it("keeps the second chat library out of the app", () => {
    const importsIt = new RegExp("[\"']@" + "assistant-ui/")
    const offenders = appSourceFiles().filter((file) =>
      importsIt.test(readApp(file))
    )
    expect(offenders).toEqual([])
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
