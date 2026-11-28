export const SURFACE_TOKENS = [
  "surface-sunken",
  "input-border",
  "hairline",
  "subtle-foreground",
]

export const ROOT_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "radius",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  ...SURFACE_TOKENS,
]

const tokenFor = (name) => `var(--${name})`

const TOKEN_GREYS = [
  ["card", ["#ffffff", "#fff"]],
  ["foreground", ["#1a1a1a", "#111111", "#2f2f31"]],
  ["muted-foreground", ["#3c3c40", "#59595b", "#5c5c5e", "#71717a"]],
  ["subtle-foreground", ["#8a8a8e", "#969799", "#a0a0a2", "#a1a1aa"]],
  ["muted", ["#f0f0f1", "#f1f1f3"]],
  ["sidebar-accent", ["#e1e1e2"]],
  ["border", ["#e2e2e2", "#e4e4e7", "#e6e6e8"]],
  ["input-border", ["#d8dee7"]],
  ["hairline", ["#ededef", "#ececee"]],
]

export const TOKEN_FOR_HEX = new Map(
  TOKEN_GREYS.flatMap(([name, hexes]) =>
    hexes.map((hex) => [hex, tokenFor(name)])
  )
)

const BLACK_ALPHA = /^#000000([0-9a-f]{2})$/

function blackShadow(hex) {
  const alpha = BLACK_ALPHA.exec(hex)
  if (!alpha) return null
  const percent = Math.round((parseInt(alpha[1], 16) / 255) * 100)
  return `rgb(0 0 0 / ${percent}%)`
}

export function replacementFor(hex) {
  const lower = hex.toLowerCase()
  return TOKEN_FOR_HEX.get(lower) ?? blackShadow(lower)
}

export const HEX_KEPT = new Map([
  [
    "features/coach/design/cap-notice.css",
    "the usage cap notice paints a blue mesh gradient; its hues are illustration, not a surface, line or text grey",
  ],
  ...["email-code", "session-expired", "welcome"].map((name) => [
    `features/auth/design/${name}.css`,
    "the sign-in screens use error reds that no token names yet; their greys move with the reds in one sweep",
  ]),
  ...[
    "letter-block-editor",
    "letter-drafting",
    "letter-editor",
    "letter-sheet",
  ].map((name) => [
    `features/paper/design/${name}.css`,
    "the Paper document page prints its own ink greys on white paper, the same exception as the CV print templates",
  ]),
])

export const ROOT_TOKEN_REDECLARE_KEPT = new Map([
  [
    "features/landing/landing.css",
    "the public landing page softens its muted text inside its own hero; it does not render app screens",
  ],
])

const HEX = /#[0-9a-f]{3,8}\b/gi
const FEATURE_CSS = /(?:^|\/)(features\/([a-z-]+)\/(?:[a-z-]+\/)*[a-z-]+\.css)$/
const DESIGN_CSS = /^features\/[a-z-]+\/design\/[a-z-]+\.css$/
const ROOT_TOKEN_DECLARATION = new RegExp(
  `(?<![\\w-])--(${ROOT_TOKENS.join("|")})\\s*:`,
  "g"
)

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export const TOKEN_HINT = `use a token from packages/ui/src/styles/globals.css (${[
  "foreground",
  "muted-foreground",
  "subtle-foreground",
  "card",
  "background",
  "surface-sunken",
  "muted",
  "hairline",
  "border",
]
  .map(tokenFor)
  .join(", ")})`

function hexProblems(source, label) {
  return [...source.matchAll(HEX)].map((match) => {
    const use = replacementFor(match[0])
    return `${label}:${lineOf(source, match.index)}: ${match[0]}; ${
      use ? `use ${use}` : TOKEN_HINT
    }`
  })
}

function unscopedSelectors(source, label, feature) {
  const problems = []
  for (const rule of source.matchAll(/([^{}]+)\{/g)) {
    const selector = rule[1].trim()
    if (selector.startsWith("@")) continue
    const scoped = selector
      .split(",")
      .every((part) => part.trim().startsWith(`[data-surface="${feature}"]`))
    if (!scoped)
      problems.push(
        `${label}:${lineOf(source, rule.index)}: ${selector}; a design file that keeps hex colours scopes every selector to [data-surface="${feature}"]`
      )
  }
  return problems
}

function redeclaredRootTokens(source, label) {
  return [...source.matchAll(ROOT_TOKEN_DECLARATION)].map(
    (match) =>
      `${label}:${lineOf(source, match.index)}: --${match[1]} redeclared; a screen reads the globals.css token instead of mixing its own (use ${tokenFor("hairline")} for the light line, ${tokenFor("surface-sunken")} for the page step)`
  )
}

export function detect(source, file) {
  const match = FEATURE_CSS.exec(file.replaceAll("\\", "/"))
  if (!match) return []
  const [, feature, featureName] = match
  const problems = ROOT_TOKEN_REDECLARE_KEPT.has(feature)
    ? []
    : redeclaredRootTokens(source, feature)
  if (!DESIGN_CSS.test(feature)) return problems
  if (HEX_KEPT.has(feature))
    return [...problems, ...unscopedSelectors(source, feature, featureName)]
  return [...problems, ...hexProblems(source, feature)]
}

export function tokenize(source) {
  return source.replace(HEX, (hex) => replacementFor(hex) ?? hex)
}
