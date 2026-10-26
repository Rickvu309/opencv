// Lints React/TS/CSS source against the opencv rules. Reports file:line.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, extname, relative } from "node:path"
import { lintText } from "../lint.js"

const EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".css", ".html", ".mdx"])
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  "coverage",
])
// Hex values the kit uses on purpose inside components (labels, tone text, hover states, the dark auth panel, the Google logo).
const KNOWN_HEX = [
  "#1B1B1F",
  "#1A1A1A",
  "#E04848",
  "#CC3F3F",
  "#2E8A5C",
  "#8A6A00",
  "#C53F3F",
  "#3A5FD9",
  "#9DB0F2",
  "#FAFAFA",
  "#EEF1FB",
  "#F4F4F6",
  "#06070B",
  "#0B0C10",
  "#15171E",
  "#1A1C24",
  "#7AD3E3",
  "#7E93F7",
  "#B08CF5",
  "#FFFFFF",
  "#FFF",
  "#000000",
  "#EA4335",
  "#4285F4",
  "#FBBC05",
  "#34A853",
]
const ORANGE_HEX = /#E8542A|#FBE7E0|--ds-accent\b/i
const ORANGE_CLASS = /\b(?:bg|text|border|ring|fill|stroke)-accent\b/i
// A translucent scrim (bg-black/50) is not a primary button.
const BLACK_BTN =
  /\b(?:bg-black(?!\/)|bg-neutral-9\d\d|bg-zinc-9\d\d|bg-gray-9\d\d|bg-slate-9\d\d|bg-stone-9\d\d|bg-\[#(?:000|111|1A1A1A|1B1B1F)\w*\])\b/

function hsl(hex) {
  let h = hex.slice(1)
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  const n = parseInt(h.slice(0, 6), 16)
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const hue =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4
  return { h: hue * 60, s, l }
}

/** Blanks comments but keeps line numbers. */
function stripComments(src, ext) {
  const blank = (m) => m.replace(/[^\n]/g, " ")
  let s = src.replace(/\/\*[\s\S]*?\*\//g, blank)
  if (ext !== ".css" && ext !== ".html")
    s = s.replace(
      /(^|[^:'"`])\/\/[^\n]*/g,
      (m, p) => p + blank(m.slice(p.length))
    )
  if (ext === ".html") s = s.replace(/<!--[\s\S]*?-->/g, blank)
  return s
}

/** User-facing text: string literals and JSX text. */
function texts(src) {
  const out = []
  const lineAt = (i) => src.slice(0, i).split("\n").length
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])+)\1/g))
    out.push({ text: m[2], line: lineAt(m.index), literal: true })
  for (const m of src.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g))
    out.push({ text: m[1].trim(), line: lineAt(m.index) })
  return out
}

const COPY_ERRORS = new Set(["brand-name", "em-dash", "middle-dot", "oops"])

export function lintSource(file, src, kit, target = "kit") {
  const ext = extname(file)
  const clean = stripComments(src, ext)
  const lines = clean.split("\n")
  const findings = []
  const add = (line, rule, level, message) =>
    findings.push({ file, line, rule, level, message })
  const palette = new Set([
    ...Object.values(kit.tokens)
      .filter(
        (t) =>
          t.type === "color" &&
          typeof t.value === "string" &&
          t.value.startsWith("#")
      )
      .map((t) => t.value.toUpperCase().slice(0, 7)),
    ...Object.values(kit.glow).flatMap((g) =>
      g.colors.map((c) => c.toUpperCase())
    ),
    ...KNOWN_HEX,
  ])

  lines.forEach((l, i) => {
    const n = i + 1
    const orange =
      target === "shadcn"
        ? ORANGE_HEX.test(l)
        : ORANGE_HEX.test(l) || ORANGE_CLASS.test(l)
    if (orange)
      add(
        n,
        "orange-accent",
        "error",
        target === "shadcn"
          ? "The reserved orange hex. bg-accent is a stock hover surface, not the orange."
          : "The reserved orange. No orange dots or tints; use text-fg or a grey icon."
      )
    if (BLACK_BTN.test(l) && /text-white/.test(l))
      add(
        n,
        "black-primary",
        "error",
        'Black button with white text. Primary buttons use <Button variant="primary"> (the glow).'
      )
    for (const m of l.matchAll(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g)) {
      const hex = m[0].toUpperCase().slice(0, 7)
      if (palette.has(hex)) continue
      const { h, s, l: li } = hsl(hex)
      if (s > 0.25 && li > 0.08 && li < 0.97 && h >= 12 && h <= 55)
        add(
          n,
          "warm-tint",
          "error",
          `${m[0]} is a warm tint. The app stays cool and grayscale.`
        )
      else
        add(
          n,
          "raw-hex",
          "info",
          `${m[0]} is not a theme color. Use a theme class (bg-surface, text-fg-2, border-border).`
        )
    }
    if (/font-family:\s*(?!.*(Inter|var\())/i.test(l) && ext === ".css")
      add(n, "font", "warning", "Use Inter (font-sans).")
  })

  if (ext !== ".css") {
    for (const t of texts(clean)) {
      if (
        !t.text ||
        (t.literal && /^[\w./@~:-]+$/.test(t.text) && !/OpenCV/.test(t.text))
      )
        continue
      for (const f of lintText(t.text)) {
        if (f.rule === "title-case") continue
        const level =
          target === "shadcn" && COPY_ERRORS.has(f.rule) ? "warning" : f.level
        add(t.line, f.rule, level, `"${t.text.slice(0, 48)}": ${f.message}`)
      }
    }
  }
  return findings
}

export function lintPaths(paths, kit, root, target = "kit") {
  const files = []
  const walk = (p) => {
    const st = statSync(p)
    if (st.isDirectory()) {
      for (const f of readdirSync(p)) if (!SKIP_DIRS.has(f)) walk(join(p, f))
    } else if (EXT.has(extname(p)) && !p.endsWith("opencv.css")) files.push(p)
  }
  paths.forEach(walk)
  return files.flatMap((f) =>
    lintSource(relative(root, f) || f, readFileSync(f, "utf8"), kit, target)
  )
}
