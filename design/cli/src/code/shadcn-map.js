// Rewrites opencv-kit classes onto the stock shadcn vocabulary.
// The class table is the proto/kit-shadcn-map codemod. Hex and raw controls
// get a second pass so a generated screen can report what is left.

const UTIL =
  "bg|text|border|ring|from|to|via|fill|stroke|outline|placeholder|divide|decoration|accent|caret"

const COLORS = [
  ["border-strong", "input"],
  ["block-hover", "muted/50"],
  ["success-soft", "chart-2/10"],
  ["danger-soft", "destructive/10"],
  ["warning-soft", "chart-4/10"],
  ["info-soft", "chart-1/10"],
  ["stage-interview", "chart-2"],
  ["stage-applied", "chart-4"],
  ["stage-closed", "chart-5"],
  ["stage-saved", "chart-5"],
  ["stage-offer", "chart-3"],
  ["placeholder", "muted-foreground/60"],
  ["selection", "accent"],
  ["site-surface", "card"],
  ["site-panel", "muted"],
  ["site-muted", "muted-foreground"],
  ["site-faint", "muted-foreground"],
  ["site-text", "foreground"],
  ["site-line", "border"],
  ["site-bg", "background"],
  ["sidebar", "sidebar"],
  ["surface", "card"],
  ["canvas", "background"],
  ["subtle", "muted"],
  ["active", "accent"],
  ["hover", "accent"],
  ["chip", "muted"],
  ["fg-3", "muted-foreground/70"],
  ["fg-2", "muted-foreground"],
  ["fg", "foreground"],
  ["success", "chart-2"],
  ["danger", "destructive"],
  ["warning", "chart-4"],
  ["indigo", "chart-3"],
  ["info", "chart-1"],
]

const TEXT = [
  ["caption", "xs"],
  ["small", "xs"],
  ["body", "sm"],
  ["title", "base"],
  ["h2", "xl"],
  ["page", "2xl"],
]

const RADIUS = {
  chip: "sm",
  row: "md",
  btn: "md",
  tile: "lg",
  card: "lg",
  panel: "xl",
  media: "2xl",
  site: "3xl",
}

const SHADOW = { pop: "lg", dialog: "xl", shot: "2xl" }

// Arbitrary kit hex -> stock color utility (opacity included when the kit used it).
const HEX_HOME = {
  FFF: "background",
  FFFFFF: "background",
  FAFAFA: "background",
  F4F4F6: "muted",
  EEF1FB: "chart-1/10",
  "1B1B1F": "foreground",
  "1A1A1A": "foreground",
  E04848: "destructive",
  CC3F3F: "destructive",
  C53F3F: "destructive",
  "2E8A5C": "chart-2",
  "8A6A00": "chart-4",
  "3A5FD9": "chart-1",
  "9DB0F2": "ring",
  "1B1B1F0F": "foreground/6",
  "1B1B1F80": "foreground/50",
  "1A1A1A40": "foreground/25",
}

// Logos are never recolored. These stay, and the residue names them.
export const HAND_FINISH_HEX = ["#EA4335", "#4285F4", "#FBBC05", "#34A853"]

function colorDest(match, token, dest, offset, whole) {
  const after = whole.slice(offset + match.length)
  const prefix = match.slice(0, match.length - token.length)
  let stock = dest
  if (dest.includes("/") && /^\/\d{1,3}(?![\w-])/.test(after))
    stock = dest.replace(/\/\d{1,3}$/, "")
  return prefix + stock
}

export function mapClasses(source) {
  let next = source
  const colors = [...COLORS].sort((a, b) => b[0].length - a[0].length)
  for (const [token, dest] of colors) {
    const re = new RegExp(`(?<![\\w-])(?:${UTIL})-${token}(?![\\w-])`, "g")
    next = next.replace(re, (match, offset, whole) =>
      colorDest(match, token, dest, offset, whole)
    )
  }
  next = next.replace(
    /(?<![\w-])(ring|outline)-focus(?![\w-])/g,
    (match, util) => `${util}-ring`
  )
  for (const [token, dest] of TEXT) {
    const re = new RegExp(`(?<![\\w-])text-${token}(?![\\w-])`, "g")
    next = next.replace(re, `text-${dest}`)
  }
  next = next.replace(
    /(?<![\w-])rounded(-(?:tl|tr|bl|br|t|b|l|r|s|e))?-(chip|row|btn|tile|card|panel|media|site)(?![\w-])/g,
    (match, side, token) => `rounded${side ?? ""}-${RADIUS[token]}`
  )
  next = next.replace(
    /(?<![\w-])shadow-(pop|dialog|shot)(?![\w-])/g,
    (match, token) => `shadow-${SHADOW[token]}`
  )
  next = next.replace(
    /(?<![\w-])duration-(?:\d+|base|fast|slow)(?![\w-])/g,
    "duration-(--duration-micro)"
  )
  next = next.replace(
    /(?<![\w-])ease-(?:standard|emphasized)(?![\w-])/g,
    "ease-(--ease-micro)"
  )
  return next
}

function rewriteHex(source) {
  let next = source.replace(/\[#([0-9A-Fa-f]{3,8})\]/g, (match, hex) => {
    const home = HEX_HOME[hex.toUpperCase()]
    return home ?? match
  })
  next = next.replace(
    /(stroke|fill)="#(?:fff|FFF|ffffff|FFFFFF)"/g,
    '$1="var(--background)"'
  )
  return next
}

function renameRaw(source) {
  return source
    .replace(/<button\b/g, "<Button")
    .replace(/<\/button>/g, "</Button>")
    .replace(/<input\b/g, "<Input")
    .replace(/<\/input>/g, "</Input>")
    .replace(/<textarea\b/g, "<Textarea")
    .replace(/<\/textarea>/g, "</Textarea>")
    .replace(/<select\b/g, "<Select")
    .replace(/<\/select>/g, "</Select>")
}

function rewriteRouter(source) {
  return source.replace(/(['"])react-router\1/g, "$1@tanstack/react-router$1")
}

const KIT_MODULES = new Set([
  "cn",
  "brand",
  "button",
  "field",
  "choice",
  "display",
  "feedback",
  "overlay",
  "shell",
  "apply",
  "inbox",
  "coach",
  "settings",
  "paper",
])

// Kit export -> file under @workspace/ui/components, or "cn" for the helper.
// A name missing here has no file on the app and stays a hand-finish line.
export const UI_EXPORT = {
  cn: "cn",
  Avatar: "avatar",
  Badge: "badge",
  Brand: "brand",
  Button: "button",
  ConfirmDelete: "confirm-delete",
  Dialog: "dialog",
  Field: "field",
  Input: "input",
  Kbd: "kbd",
  Mark: "brand",
  Meter: "meter",
  PageHeader: "page-header",
  Select: "select",
  Skeleton: "skeleton",
  StageIcon: "stage-icon",
  Textarea: "textarea",
  Toolbar: "toolbar",
  UsageBar: "usage-bar",
}

export function uiSpecifier(file) {
  return file === "cn" ? "cn" : `@workspace/ui/components/${file}`
}

function rewriteKitImports(source) {
  return source.replace(
    /import\s+(type\s+)?\{([^}]*)\}\s+from\s+(['"])(?:~components\/|\.\/)([\w-]+)\3/g,
    (full, typeKw, body, quote, mod) => {
      if (!KIT_MODULES.has(mod)) return full
      const groups = new Map()
      const notes = []
      for (const spec of body.split(",")) {
        const flat = spec.trim().replace(/\s+/g, " ")
        if (!flat) continue
        const parsed = flat.match(/^(type\s+)?(\w+)(?:\s+as\s+(\w+))?$/)
        if (!parsed) {
          notes.push(
            `// hand-finish: ${mod} export ${flat} has no @workspace/ui counterpart`
          )
          continue
        }
        const name = parsed[2]
        const ui = UI_EXPORT[name]
        if (!ui) {
          notes.push(
            `// hand-finish: ${mod} export ${name} has no @workspace/ui counterpart`
          )
          continue
        }
        const rendered = parsed[3] ? `${name} as ${parsed[3]}` : name
        const piece = !typeKw && parsed[1] ? `type ${rendered}` : rendered
        const dest = uiSpecifier(ui)
        if (!groups.has(dest)) groups.set(dest, [])
        groups.get(dest).push(piece)
      }
      const lines = []
      for (const [dest, names] of groups)
        lines.push(
          `import ${typeKw || ""}{ ${names.join(", ")} } from ${quote}${dest}${quote}`
        )
      return [...lines, ...notes].join("\n")
    }
  )
}

export function toShadcn(source) {
  const mapped = rewriteRouter(
    renameRaw(rewriteHex(mapClasses(source)))
  ).replace(/(?<![\w-])glow-button(?![\w-])/g, "glow")
  return rewriteKitImports(mapped)
}

const HEX_RE = /#(?:[0-9A-Fa-f]{3,8})\b/g
const RAW_RE = /<(button|input|textarea|select)\b/g

export function residueOf(file, source) {
  const hex = []
  const handFinish = []
  for (const match of source.matchAll(HEX_RE)) {
    const value = match[0].toUpperCase()
    const key = value.length > 7 ? value.slice(0, 7) : value
    if (HAND_FINISH_HEX.includes(key))
      handFinish.push(
        `${file} ${value} Google mark (logos are never recolored)`
      )
    else hex.push(`${file} ${value}`)
  }
  const raw = [...source.matchAll(RAW_RE)].map((match) => `${file} ${match[0]}`)
  if (
    /@tanstack\/react-router/.test(source) &&
    /useParams|useLocation/.test(source)
  )
    handFinish.push(
      `${file} react-router hooks now import @tanstack/react-router (check useParams and useLocation)`
    )
  if (/<(Button|Input|Textarea|Select)\b/.test(source))
    handFinish.push(
      `${file} raw controls renamed onto Button, Input, Textarea, Select from @workspace/ui`
    )
  for (const line of source.split("\n")) {
    const note = line.match(/^\s*\/\/ hand-finish: (.+)$/)
    if (note) handFinish.push(`${file} ${note[1]}`)
  }
  for (const cls of [
    "shadow-glow-lg",
    "shadow-glow",
    "focus-ring",
    "glow-button",
  ]) {
    if (new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(source))
      handFinish.push(`${file} class ${cls} has no stock utility`)
  }
  for (const match of source.matchAll(/~components\/([\w-]+)/g))
    handFinish.push(`${file} import ~components/${match[1]} was not rewritten`)
  return { hex, raw, handFinish }
}

export function formatResidue(rows) {
  const hex = rows.flatMap((row) => row.hex)
  const raw = rows.flatMap((row) => row.raw)
  const hand = [...new Set(rows.flatMap((row) => row.handFinish))]
  const lines = [
    "target shadcn",
    `hex ${hex.length}`,
    ...hex.map((item) => `  ${item}`),
    `raw ${raw.length}`,
    ...raw.map((item) => `  ${item}`),
    hand.length ? "hand-finish" : "hand-finish 0",
    ...hand.map((item) => `  ${item}`),
  ]
  return lines.join("\n")
}
