"use client"

/* eslint-disable react-hooks/refs -- affectUI tracks entering columns in refs during render */

import { useEffect, useMemo, useRef, useState } from "react"

export type NumberTickerProps = {
  value: number
  format?: Intl.NumberFormatOptions
  locale?: string
  durationMs?: number
  delayMs?: number
  className?: string
}

type Part = { key: string; digit: number } | { key: string; char: string }

function splitIntoPartsKeyedFromTheRight(text: string): Part[] {
  const chars = Array.from(text)
  const parts: Part[] = []
  let d = 0
  let s = 0
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i]
    if (c >= "0" && c <= "9")
      parts.unshift({ key: `d${d++}`, digit: c.charCodeAt(0) - 48 })
    else parts.unshift({ key: `s${s++}`, char: c })
  }
  return parts
}

const DIGIT_STACK_WITH_WRAP_ZERO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
const mod10 = (n: number) => ((n % 10) + 10) % 10
const ease = (t: number) => 1 - Math.pow(1 - t, 4)
const place = (el: HTMLElement, pos: number) => {
  el.style.transform = `translateY(${(-mod10(pos) / DIGIT_STACK_WITH_WRAP_ZERO.length) * 100}%)`
}

type Roll = { pos: number; from: number; to: number }

export function NumberTicker({
  value,
  format,
  locale,
  durationMs = 900,
  delayMs = 0,
  className,
}: NumberTickerProps) {
  const fmtKey = JSON.stringify(format ?? {})
  const text = useMemo(
    () => new Intl.NumberFormat(locale, format).format(value),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmtKey stands in for the format object
    [value, locale, fmtKey]
  )
  const parts = useMemo(() => splitIntoPartsKeyedFromTheRight(text), [text])

  const root = useRef<HTMLSpanElement>(null)
  const rolls = useRef(new Map<string, Roll>())
  const stacks = useRef(new Map<string, HTMLElement>())
  const prev = useRef(0)
  const up = useRef(true)
  const mounted = useRef(false)
  const entering = useRef(new Set<string>())
  const seen = useRef(new Set<string>())
  const [started, setStarted] = useState(false)

  const keysNow = new Set(parts.filter((p) => "digit" in p).map((p) => p.key))
  for (const k of keysNow)
    if (mounted.current && !seen.current.has(k)) entering.current.add(k)
  for (const k of entering.current)
    if (!keysNow.has(k)) entering.current.delete(k)
  seen.current = keysNow

  useEffect(() => {
    mounted.current = true
    const el = root.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true)
      return
    }
    let timer = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        timer = window.setTimeout(() => setStarted(true), delayMs)
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the count-in starts once, when the number first scrolls into view
  }, [])

  useEffect(() => {
    if (!started) return
    if (value !== prev.current) up.current = value > prev.current
    prev.current = value
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const keys = new Set<string>()

    for (const p of parts) {
      if (!("digit" in p)) continue
      keys.add(p.key)
      const r = rolls.current.get(p.key) ?? { pos: 0, from: 0, to: 0 }
      const delta = up.current
        ? mod10(p.digit - r.pos)
        : -mod10(r.pos - p.digit)
      r.from = r.pos
      r.to = r.pos + delta
      if (reduce) r.pos = r.from = r.to
      rolls.current.set(p.key, r)
    }
    for (const k of rolls.current.keys())
      if (!keys.has(k)) rolls.current.delete(k)

    const apply = () => {
      for (const [k, r] of rolls.current) {
        const el = stacks.current.get(k)
        if (el) place(el, r.pos)
      }
    }
    if (reduce) return apply()

    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs)
      const e = ease(t)
      for (const r of rolls.current.values())
        r.pos = r.from + (r.to - r.from) * e
      apply()
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [parts, started, value, durationMs])

  return (
    <>
      <style href="ui-number-ticker" precedence="default">
        {css}
      </style>
      <span
        data-slot="number-ticker"
        ref={root}
        className={["ui-nt", className].filter(Boolean).join(" ")}
        aria-live="polite"
      >
        <span className="ui-nt__sr">{text}</span>
        <span className="ui-nt__track" aria-hidden="true">
          {parts.map((p) =>
            "digit" in p ? (
              <span
                key={p.key}
                className="ui-nt__col"
                data-enter={entering.current.has(p.key) || undefined}
              >
                <span
                  className="ui-nt__stack"
                  ref={(el) => {
                    if (!el) return
                    stacks.current.set(p.key, el)
                    place(el, rolls.current.get(p.key)?.pos ?? 0)
                    return () => {
                      if (stacks.current.get(p.key) === el)
                        stacks.current.delete(p.key)
                    }
                  }}
                >
                  {DIGIT_STACK_WITH_WRAP_ZERO.map((n, i) => (
                    <span key={i} className="ui-nt__cell">
                      {n}
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              <span key={p.key} className="ui-nt__static">
                {p.char}
              </span>
            )
          )}
        </span>
      </span>
    </>
  )
}

const css = `
.ui-nt {
  --ui-nt-lh: 1.15em;
  position: relative;
  display: inline-flex;
  line-height: var(--ui-nt-lh);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ui-nt__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.ui-nt__track {
  display: inline-flex;
  align-items: flex-start;
  height: var(--ui-nt-lh);
  line-height: var(--ui-nt-lh);
}
.ui-nt__col {
  display: inline-block;
  height: var(--ui-nt-lh);
  overflow: hidden;
  -webkit-mask-image: linear-gradient(transparent, #000 14%, #000 86%, transparent);
  mask-image: linear-gradient(transparent, #000 14%, #000 86%, transparent);
}
.ui-nt__col[data-enter] { animation: ui-nt-in var(--duration-panel) var(--ease-panel) both; }
.ui-nt__stack {
  display: flex;
  flex-direction: column;
  will-change: transform;
}
.ui-nt__cell,
.ui-nt__static {
  display: block;
  height: var(--ui-nt-lh);
  text-align: center;
}
.ui-nt__static { white-space: pre; }

@keyframes ui-nt-in {
  from { opacity: 0; transform: translateY(-35%); }
}
@media (prefers-reduced-motion: reduce) {
  .ui-nt__col[data-enter] { animation: none; }
}

`
