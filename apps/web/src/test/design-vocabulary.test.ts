// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  SURFACE_TOKENS,
  detect as designCssTokenProblems,
} from "../../../../scripts/lib/design-css-tokens.mjs"

const webRoot = fileURLToPath(new URL("../..", import.meta.url))
const srcDir = path.join(webRoot, "src")
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
  /(?:-\[#[0-9A-Fa-f]{3,8}\]|["'`]#[0-9A-Fa-f]{3,8}["'`]|#[0-9A-Fa-f]{6,8}\b|#(?=[0-9a-f]*[a-f])[0-9a-f]{3}\b)/gi

const HUE_FUNCTION_EXCEPT_BLACK_AND_RELATIVE_RE =
  /\b(?:oklch|oklab|lab|lch|hsla?|hwb|rgba?)\((?!from[\s_])(?!\s*0[\s,_]+0[\s,_]+0\b)[^)]*\)/g

const PALETTE_RE = new RegExp(
  `(?<![\\w-])(?:${PALETTE_UTILITIES})-(?:${PALETTE_HUES.join("|")})-(?:\\d{2,3})(?:/\\d{1,3})?\\b`,
  "g"
)

function featureDesignCssProblems(
  file: string,
  source: string
): string[] | null {
  if (!/^features\/[a-z-]+\/design\/[a-z-]+\.css$/.test(file)) return null
  return [
    ...designCssTokenProblems(source, file),
    ...hits(source, PALETTE_RE),
    ...hits(source, HUE_FUNCTION_EXCEPT_BLACK_AND_RELATIVE_RE),
  ]
}

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
  ...SURFACE_TOKENS,
]

const STOCK_ROOT = [...STOCK_COLORS, "radius"]

const MOTION_TOKENS = [
  "duration-micro",
  "duration-panel",
  "ease-micro",
  "ease-panel",
]

type ReadableVariableGroup = { reason: string; names: readonly string[] }

const READABLE_VARIABLE_GROUPS: readonly ReadableVariableGroup[] = [
  {
    reason:
      "shadcn colour tokens and the surface, hairline and subtle text tokens declared in globals.css and read as Tailwind colour utilities",
    names: STOCK_COLORS,
  },
  {
    reason:
      "motion tokens defined once in globals.css and read as duration and easing utilities",
    names: MOTION_TOKENS,
  },
  {
    reason:
      "radius scale derived from --radius in globals.css and read as rounded-* utilities",
    names: [
      "radius-sm",
      "radius-md",
      "radius-lg",
      "radius-xl",
      "radius-2xl",
      "radius-3xl",
      "radius-4xl",
    ],
  },
  {
    reason:
      "Base UI sets these at runtime on popups, and select.tsx reads them as max-height, width and transform-origin",
    names: [
      "transform-origin",
      "available-height",
      "available-width",
      "anchor-width",
      "anchor-height",
    ],
  },
  {
    reason:
      "the stock Card sets this as an arbitrary property on itself and reads it for its gap and padding",
    names: ["card-spacing"],
  },
  {
    reason:
      "theme font stacks from globals.css that the affectUI widgets inherit",
    names: ["font-sans", "font-mono"],
  },
  {
    reason:
      "per-element entrance stagger that reveal.tsx and palette.ts set inline, read as the animation delay in app-shell.css",
    names: ["landing-delay"],
  },
  {
    reason:
      "landing hero fluid sizes; no declaration remains under apps/web/src, so these names are unused and can be deleted",
    names: ["landing-h1-mobile", "landing-h1-desktop"],
  },
  {
    reason:
      "sidebar-frame.tsx sets it inline from the resized width, and the frame's w-(--sidebar-width) class reads it",
    names: ["sidebar-width"],
  },
]

const READABLE_VARIABLES = new Set<string>(
  READABLE_VARIABLE_GROUPS.flatMap((group) => group.names)
)

const PAPER_CSS_CV_PRINT_VARIABLE_RE = /^cv-/

const AFFECT_INJECTED_STYLESHEET_VARIABLE_RE = /^(?:ui-[a-z]+-|[ui]$)/

const AFFECT_FILES_KEPT_IN_THE_APP = new Set<string>()

const STAGESHOW_SCENE_DIR = "features/landing/figures/phone/"

const STAGESHOW_KIT_VARIABLE_RE = /^ss-/

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
  /(?<![\w-])(?:bg|text|border|ring|from|to|via|fill|stroke|outline)-(?:success|warning|info)(?:-foreground)?(?![\w-])|var\(--(?:success|warning|info)/g

const VARIABLE_READ_RE = /(?:var\(|[\w-]\()(--[a-zA-Z0-9-]+)/g

type AllowlistEntry = { file: string; reason: string }

const RAW_COLOR_ALLOWLIST: readonly AllowlistEntry[] = [
  {
    file: "features/paper/cv-templates/product.tsx",
    reason:
      "CV print paper, the documented exception in docs/agents/design-parity.md: a print layout on white paper",
  },
]

const RAW_INTERACTIVE_ALLOWLIST: readonly AllowlistEntry[] = []

const HIDDEN_FILE_PICKER = "components/hidden-file-picker.tsx"

const allowedFiles = (entries: readonly AllowlistEntry[]) =>
  new Set(entries.map((entry) => entry.file))

function appSourceFiles() {
  return readdirSync(srcDir, { recursive: true, encoding: "utf8" }).filter(
    (file) =>
      /\.(tsx?|css)$/.test(file) &&
      !file.includes(".test.") &&
      !file.startsWith("test/")
  )
}

function kitSourceFiles() {
  return readdirSync(path.join(uiDir, "components"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `components/${file}`)
}

function readApp(file: string) {
  return readFileSync(path.join(srcDir, file), "utf8")
}

function readKit(file: string) {
  return readFileSync(path.join(uiDir, file), "utf8")
}

function firstTopLevelCssBlockBody(css: string, selector: string) {
  const match = new RegExp(`^${selector} \\{\\n([\\s\\S]*?)^\\}`, "m").exec(css)
  expect(match, `${selector} block`).not.toBeNull()
  return match![1]
}

function declared(block: string) {
  return [...block.matchAll(/^\s*--([\w-]+):/gm)].map((match) => match[1])
}

function rel(file: string) {
  return file.replaceAll("\\", "/")
}

function hits(source: string, pattern: RegExp) {
  return source.match(pattern) ?? []
}

function requireReasonedAllowlist(
  entries: readonly AllowlistEntry[],
  label: string
) {
  for (const entry of entries) {
    expect(
      entry.reason.trim().length,
      `${label} allowlist entry "${entry.file}" needs a reason`
    ).toBeGreaterThan(0)
  }
}

describe("app code uses shadcn variables and stock Tailwind, with no raw hex or named palette class", () => {
  it("gives every vocabulary allowlist entry a reason", () => {
    requireReasonedAllowlist(RAW_COLOR_ALLOWLIST, "vocabulary")
  })

  it("gives every readable-variable group a reason", () => {
    for (const group of READABLE_VARIABLE_GROUPS) {
      expect(
        group.reason.trim().length,
        `readable-variable group ${group.names.join(", ")} needs a reason`
      ).toBeGreaterThan(0)
    }
  })

  it("forbids raw hex, functional colours and named Tailwind palette classes outside the allowlist", () => {
    const allowed = allowedFiles(RAW_COLOR_ALLOWLIST)
    const violations: string[] = []
    const files = [
      ...appSourceFiles().map((file) => [file, readApp(file)] as const),
      ...kitSourceFiles().map((file) => [file, readKit(file)] as const),
    ]

    for (const [file, source] of files) {
      if (allowed.has(rel(file))) continue
      const found =
        featureDesignCssProblems(rel(file), source) ??
        [HEX_RE, PALETTE_RE, HUE_FUNCTION_EXCEPT_BLACK_AND_RELATIVE_RE].flatMap(
          (pattern) => hits(source, pattern)
        )
      if (found.length === 0) continue
      violations.push(`${rel(file)}: ${found.join(", ")}`)
    }

    expect(violations, violations.join("\n")).toEqual([])
  })

  it("fails a hex colour in a feature design file and names the token to use", () => {
    const check = (file: string, source: string) =>
      featureDesignCssProblems(file, source)
    const file = "features/example/design/example.css"
    expect(
      check(file, '[data-surface="example"] h2 { border-color: #ededef; }')
    ).toEqual([`${file}:1: #ededef; use var(--hairline)`])
    expect(
      check(file, '[data-surface="example"] h2 { color: #123456; }')?.[0]
    ).toMatch(
      /#123456; use a token from packages\/ui\/src\/styles\/globals\.css/
    )
    expect(
      check(file, '[data-surface="example"] h2 { color: var(--foreground); }')
    ).toEqual([])
    expect(check("features/example/example.tsx", "#1A1A1A")).toBeNull()
  })

  it("fails a screen that redeclares a globals.css token", () => {
    const found = featureDesignCssProblems(
      "features/example/design/example.css",
      ".example { --border: color-mix(in oklch, var(--foreground) 8%, transparent); }"
    )
    expect(found?.[0]).toMatch(/--border redeclared/)
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
      ...appSourceFiles().map(
        (file) =>
          [
            file,
            readApp(file),
            AFFECT_FILES_KEPT_IN_THE_APP.has(rel(file)),
          ] as const
      ),
      ...kitSourceFiles().map((file) => [file, readKit(file), true] as const),
    ]
    for (const [file, source, isAffect] of files) {
      const unknown = [...source.matchAll(VARIABLE_READ_RE)]
        .map((match) => match[1].slice(2))
        .filter(
          (name) =>
            !READABLE_VARIABLES.has(name) &&
            !PAPER_CSS_CV_PRINT_VARIABLE_RE.test(name) &&
            !(isAffect && AFFECT_INJECTED_STYLESHEET_VARIABLE_RE.test(name)) &&
            !(
              rel(file).startsWith(STAGESHOW_SCENE_DIR) &&
              STAGESHOW_KIT_VARIABLE_RE.test(name)
            ) &&
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
    expect(declared(firstTopLevelCssBlockBody(css, ":root")).sort()).toEqual(
      [...STOCK_ROOT].sort()
    )
    expect(css).toContain("color-scheme: light")
    expect(css).not.toMatch(/\.dark\b/)

    const theme = firstTopLevelCssBlockBody(css, "@theme inline")
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

describe("retired status tokens", () => {
  it("keeps success, warning and info classes and variables out of app and kit code", () => {
    const violations: string[] = []
    const files = [
      ...appSourceFiles().map((file) => [file, readApp(file)] as const),
      ...kitSourceFiles().map((file) => [file, readKit(file)] as const),
    ]
    for (const [file, source] of files) {
      const found = hits(source, LEGACY_TOKEN_RE)
      if (found.length > 0) violations.push(`${rel(file)}: ${found.join(", ")}`)
    }
    expect(violations, violations.join("\n")).toEqual([])
  })
})

describe("chat library", () => {
  it("keeps the second chat library out of the app", () => {
    const importsIt = new RegExp("[\"']@" + "assistant-ui/")
    const offenders = [
      ...appSourceFiles().filter((file) => importsIt.test(readApp(file))),
      ...kitSourceFiles().filter((file) => importsIt.test(readKit(file))),
    ]
    expect(offenders).toEqual([])
  })
})

describe("design-system adoption", () => {
  it("gives every raw-interactive allowlist entry a reason", () => {
    requireReasonedAllowlist(RAW_INTERACTIVE_ALLOWLIST, "raw-interactive")
  })

  it("hosts the only raw file input outside the kit in the hidden file picker", () => {
    const hosts = appSourceFiles()
      .filter(
        (file) => !rel(file).startsWith("features/") && file.endsWith(".tsx")
      )
      .filter((file) =>
        /<input\b/.test(readFileSync(path.join(srcDir, file), "utf8"))
      )
      .map(rel)
    expect(hosts).toEqual([HIDDEN_FILE_PICKER])
  })

  it("keeps raw button/input/textarea/select out of feature files", () => {
    const allowed = allowedFiles(RAW_INTERACTIVE_ALLOWLIST)
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
      }
    }

    expect(violations, violations.join("\n")).toEqual([])
  })
})
