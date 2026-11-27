import LineBreaker from "linebreak"
import type { Run } from "@workspace/domain/paper-doc"

import { faceKey } from "./metrics.js"
import { DEFAULT_TAB_MPT, LINK_COLOR, type TextStyle } from "./styles.js"
import type { FaceKey, FontFace, Metrics, Mpt, Segment } from "./types.js"

export type LineShape = {
  from: number
  to: number
  x: Mpt
  w: Mpt
  h: Mpt
  ascent: Mpt
  segments: readonly Segment[]
}

export type BreakInput = {
  runs: readonly Run[] | undefined
  style: TextStyle
  left: Mpt
  width: Mpt
  align: "left" | "center" | "right" | "justify"
  lineSpacing: number
  rightTab: Mpt | null
  metrics: Metrics
}

type CharStyle = {
  font: FaceKey
  face: FontFace
  sizeMpt: Mpt
  color: string
  underline: boolean
  strike: boolean
  href: string | null
}

type Part = { from: number; to: number; x: number }

const SCALE = 1000
const TRAILING = new Set([" ", "\n", "\t"])

function runStyle(base: TextStyle, run: Run, metrics: Metrics): CharStyle {
  let bold = base.bold
  let italic = base.italic
  let family = base.family
  let sizeMpt = base.sizeMpt
  let color: string | null = null
  let underline = false
  let strike = false
  let href: string | null = null
  if (run.type === "text") {
    for (const mark of run.marks ?? []) {
      if (mark.type === "bold") bold = true
      else if (mark.type === "italic") italic = true
      else if (mark.type === "underline") underline = true
      else if (mark.type === "strike") strike = true
      else if (mark.type === "link") href = mark.attrs.href
      else if (mark.type === "color") color = mark.attrs.value
      else if (mark.type === "font") family = mark.attrs.family
      else if (mark.type === "size") sizeMpt = mark.attrs.mpt
    }
  }
  const font = faceKey(family, bold, italic)
  return {
    font,
    face: metrics.face(font),
    sizeMpt,
    color: color ?? (href ? LINK_COLOR : base.color),
    underline: underline || href !== null,
    strike,
    href,
  }
}

function sameStyle(a: CharStyle, b: CharStyle): boolean {
  return (
    a.font === b.font &&
    a.sizeMpt === b.sizeMpt &&
    a.color === b.color &&
    a.underline === b.underline &&
    a.strike === b.strike &&
    a.href === b.href
  )
}

export function breakRuns(input: BreakInput): LineShape[] {
  const { metrics, style } = input
  const baseStyle = runStyle(style, { type: "hard_break" }, metrics)
  const styles: CharStyle[] = [baseStyle]
  const styleAt: number[] = []
  let text = ""
  for (const run of input.runs ?? []) {
    if (run.type === "hard_break") {
      text += "\n"
      styleAt.push(0)
      continue
    }
    const next = runStyle(style, run, metrics)
    let index = styles.findIndex((known) => sameStyle(known, next))
    if (index < 0) index = styles.push(next) - 1
    text += run.text
    for (let unit = 0; unit < run.text.length; unit += 1) styleAt.push(index)
  }

  const length = text.length
  const prefix = new Float64Array(length + 1)
  for (let i = 0; i < length; i += 1) {
    const code = text.charCodeAt(i)
    let advance = 0
    if (code !== 10 && code !== 9 && !(code >= 0xdc00 && code <= 0xdfff)) {
      const charStyle = styles[styleAt[i]!]!
      advance = charStyle.face.advance(text.codePointAt(i)!) * charStyle.sizeMpt
    }
    prefix[i + 1] = prefix[i]! + advance
  }

  const width = input.width * SCALE
  const rightTab =
    input.rightTab !== null && input.rightTab > 0
      ? input.rightTab * SCALE
      : null
  const limit = Math.max(width, rightTab ?? 0)
  const defaultTab = DEFAULT_TAB_MPT * SCALE

  const contentEnd = (s: number, e: number) =>
    e > s && text[e - 1] === "\n" ? e - 1 : e
  const trimEnd = (s: number, e: number) => {
    let end = e
    while (end > s && TRAILING.has(text[end - 1]!)) end -= 1
    return end
  }

  function place(
    s: number,
    e: number
  ): { parts: Part[]; endX: number; used: boolean } {
    const end = contentEnd(s, e)
    const trimmed = trimEnd(s, end)
    const parts: Part[] = []
    let x = 0
    let pieceStart = s
    let used = false
    for (let t = s; t < end; t += 1) {
      if (text[t] !== "\t") continue
      parts.push({ from: pieceStart, to: t, x })
      x += prefix[t]! - prefix[pieceStart]!
      let nextTab = t + 1
      while (nextTab < end && text[nextTab] !== "\t") nextTab += 1
      const pieceEnd = Math.max(t + 1, Math.min(nextTab, trimmed))
      const pieceWidth = prefix[pieceEnd]! - prefix[t + 1]!
      if (rightTab !== null && !used && x < rightTab) {
        used = true
        if (x + pieceWidth <= rightTab) x = rightTab - pieceWidth
      } else {
        x = (Math.floor(x / defaultTab) + 1) * defaultTab
      }
      pieceStart = t + 1
    }
    parts.push({ from: pieceStart, to: end, x })
    let endX = 0
    for (const part of parts) {
      if (part.from <= trimmed) {
        endX = part.x + prefix[Math.min(trimmed, part.to)]! - prefix[part.from]!
      }
    }
    return { parts, endX, used }
  }

  const fits = (s: number, e: number) => place(s, e).endX <= limit

  const nextCodePointEnd = (i: number) => {
    let end = i + (text.codePointAt(i)! > 0xffff ? 2 : 1)
    while (end < length && /\p{M}/u.test(text[end]!)) end += 1
    return end
  }

  const spans: [number, number][] = []
  const breaker = new LineBreaker(text)
  const breaks: { position: number; required: boolean }[] = []
  for (let found = breaker.nextBreak(); found; found = breaker.nextBreak()) {
    breaks.push({ position: found.position, required: found.required })
  }
  let start = 0
  let lastFit = -1
  let k = 0
  while (k < breaks.length) {
    const candidate = breaks[k]!
    if (candidate.position <= start) {
      k += 1
      continue
    }
    if (fits(start, candidate.position)) {
      k += 1
      if (candidate.required || text[candidate.position - 1] === "\n") {
        spans.push([start, candidate.position])
        start = candidate.position
        lastFit = -1
      } else {
        lastFit = candidate.position
      }
      continue
    }
    if (lastFit > start) {
      spans.push([start, lastFit])
      start = lastFit
      lastFit = -1
      continue
    }
    let end = nextCodePointEnd(start)
    while (end < candidate.position) {
      const further = nextCodePointEnd(end)
      if (further > candidate.position || !fits(start, further)) break
      end = further
    }
    spans.push([start, end])
    start = end
  }
  if (start < length || spans.length === 0 || text[length - 1] === "\n") {
    spans.push([start, length])
  }

  return spans.map(([s, e], index) => {
    const { parts, endX, used } = place(s, e)
    const end = contentEnd(s, e)
    const trimmed = trimEnd(s, end)
    const hardEnd = e > s && text[e - 1] === "\n"
    const last = index === spans.length - 1 || hardEnd
    let shift = 0
    if (input.align === "right") shift = Math.max(0, limit - endX)
    else if (input.align === "center")
      shift = Math.max(0, Math.floor((limit - endX) / 2))
    let spaces: number[] = []
    let extra = 0
    if (input.align === "justify" && !last && !used && parts.length === 1) {
      for (let i = s; i < trimmed; i += 1) if (text[i] === " ") spaces.push(i)
      extra = spaces.length > 0 ? Math.max(0, width - endX) : 0
    }
    if (extra === 0) spaces = []
    const gapAt = (i: number) => {
      let added = 0
      for (let n = 0; n < spaces.length && spaces[n]! < i; n += 1) {
        added +=
          Math.floor(extra / spaces.length) +
          (n < extra % spaces.length ? 1 : 0)
      }
      return added
    }
    const segments: Segment[] = []
    for (const part of parts) {
      let segStart = part.from
      for (let i = part.from; i <= part.to; i += 1) {
        const boundary =
          i === part.to ||
          (i > segStart && styleAt[i] !== styleAt[i - 1]) ||
          (spaces.length > 0 && i > segStart && text[i - 1] === " ")
        if (!boundary) continue
        if (i > segStart) {
          const charStyle = styles[styleAt[segStart]!]!
          const startX =
            part.x +
            prefix[segStart]! -
            prefix[part.from]! +
            shift +
            gapAt(segStart)
          const endAt =
            part.x + prefix[i]! - prefix[part.from]! + shift + gapAt(segStart)
          const x0 = Math.round(startX / SCALE)
          segments.push({
            x: input.left + x0,
            w: Math.round(endAt / SCALE) - x0,
            text: text.slice(segStart, i),
            from: segStart,
            font: charStyle.font,
            sizeMpt: charStyle.sizeMpt,
            color: charStyle.color,
            underline: charStyle.underline,
            strike: charStyle.strike,
            href: charStyle.href,
          })
        }
        segStart = i
      }
    }
    let ascent = 0
    let descent = 0
    const measured = trimmed > s ? styleAt.slice(s, trimmed) : [styleAt[s] ?? 0]
    const seen = new Set<number>()
    for (const styleIndex of measured.length > 0 ? measured : [0]) {
      if (seen.has(styleIndex)) continue
      seen.add(styleIndex)
      const charStyle = styles[styleIndex]!
      ascent = Math.max(ascent, charStyle.face.ascent * charStyle.sizeMpt)
      descent = Math.max(
        descent,
        (charStyle.face.lineGap - charStyle.face.descent) * charStyle.sizeMpt
      )
    }
    return {
      from: s,
      to: end,
      x: input.left,
      w: Math.round(limit / SCALE),
      h: Math.round(((ascent + descent) * input.lineSpacing) / SCALE),
      ascent: Math.round(ascent / SCALE),
      segments,
    }
  })
}
