import { cn } from "cn"

export type Viewport = { width: number; height: number }

export type PanelFit = {
  top: number
  bottom: number
  height: number
  problems: string[]
}

const MIN_WIDTH: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
}
const RANK = [
  "",
  "max-xl",
  "max-lg",
  "max-md",
  "max-sm",
  "sm",
  "md",
  "lg",
  "xl",
]

function applies(prefix: string, { width }: Viewport) {
  if (prefix === "") return true
  if (prefix.startsWith("max-")) return width < MIN_WIDTH[prefix.slice(4)]
  return width >= MIN_WIDTH[prefix]
}

function length(expression: string, { height }: Viewport): number {
  const text = expression.trim()
  const call = /^(min|max|clamp|calc)\((.*)\)$/.exec(text)
  if (call) {
    const [name, inner] = [call[1], call[2]]
    if (name === "calc") {
      const terms = inner.split(/-(?![^(]*\))/)
      return terms
        .slice(1)
        .reduce(
          (total, term) => total - length(term, { width: 0, height }),
          length(terms[0], { width: 0, height })
        )
    }
    const parts = inner
      .split(/,(?![^(]*\))/)
      .map((part) => length(part, { width: 0, height }))
    if (name === "min") return Math.min(...parts)
    if (name === "max") return Math.max(...parts)
    return Math.min(Math.max(parts[1], parts[0]), parts[2])
  }
  const unit = /^(\d+(?:\.\d+)?)(px|rem|vh|dvh|svh)$/.exec(text)
  if (!unit) throw new Error(`unmodelled length ${text}`)
  const value = Number(unit[1])
  if (unit[2] === "px") return value
  if (unit[2] === "rem") return value * 16
  return (value / 100) * height
}

function size(utility: string, viewport: Viewport): number | "center" {
  if (/^(svh|dvh|screen|full)$/.test(utility)) return viewport.height
  if (utility === "none") return Number.POSITIVE_INFINITY
  if (utility === "1/2") return "center"
  if (/^\d+(\.\d+)?$/.test(utility)) return Number(utility) * 4
  const arbitrary = /^\[(.*)\]$/.exec(utility)
  if (arbitrary) return length(arbitrary[1].replaceAll("_", " "), viewport)
  throw new Error(`unmodelled size ${utility}`)
}

const GEOMETRY = /^(top|h|max-h|overflow-y|overflow)-(.+)$/

export function panelFit(
  className: string,
  viewport: Viewport,
  { hasOutsideControl = false }: { hasOutsideControl?: boolean } = {}
): PanelFit {
  const chosen = new Map<string, { rank: number; value: string }>()
  for (const token of cn(className).split(/\s+/)) {
    const parts = token.split(":")
    const utility = parts.pop()!
    const prefix = parts.join(":")
    if (!RANK.includes(prefix) || !applies(prefix, viewport)) continue
    const match = GEOMETRY.exec(utility)
    if (!match) continue
    const property = match[1] === "overflow-y" ? "overflow" : match[1]
    const rank = RANK.indexOf(prefix)
    const held = chosen.get(property)
    if (!held || rank >= held.rank)
      chosen.set(property, { rank, value: match[2] })
  }
  const read = (property: string) => chosen.get(property)?.value
  const fixedHeight = read("h") ? size(read("h")!, viewport) : undefined
  const cap = read("max-h")
    ? size(read("max-h")!, viewport)
    : Number.POSITIVE_INFINITY
  const height = Math.min(
    typeof fixedHeight === "number" ? fixedHeight : Number.POSITIVE_INFINITY,
    typeof cap === "number" ? cap : Number.POSITIVE_INFINITY
  )
  const anchor = read("top") ? size(read("top")!, viewport) : 0
  const top =
    anchor === "center" ? Math.max((viewport.height - height) / 2, 0) : anchor
  const bottom = top + height
  const problems: string[] = []
  if (!Number.isFinite(height))
    problems.push("has no height cap, so long content runs off the window")
  else if (bottom > viewport.height + 0.5)
    problems.push(
      `ends at ${Math.round(bottom)}, past the ${viewport.height}px window`
    )
  if (
    typeof fixedHeight === "number" &&
    fixedHeight >= viewport.height &&
    height < viewport.height - 0.5
  )
    problems.push(
      `is a full-height panel cut to ${Math.round(height)} of ${viewport.height}px`
    )
  const overflow = read("overflow")
  if (hasOutsideControl && overflow && overflow !== "visible")
    problems.push(`clips a control placed outside it (overflow ${overflow})`)
  return { top, bottom, height, problems }
}
