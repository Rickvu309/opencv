"use client"

import { css } from "./thinking-loader-styles"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

export type ThinkingLoaderProps = {
  phases?: string[]
  interval?: number
  phase?: number
  loop?: boolean
  done?: boolean
  doneLabel?: string | ((seconds: number) => string)
  size?: "sm" | "md"
  variant?: "pill" | "plain"
  className?: string
}

const DEFAULT_PHASES = [
  "Thinking",
  "Searching the web",
  "Reading sources",
  "Writing response",
]
const LAYOUT_PIXEL_ROUNDING_PX = 1
const RAYS = Array.from({ length: 8 }, (_, i) => i)

export function ThinkingLoader({
  phases = DEFAULT_PHASES,
  interval = 2200,
  phase,
  loop = false,
  done = false,
  doneLabel = (s) => `Thought for ${s}s`,
  size = "md",
  variant = "pill",
  className,
}: ThinkingLoaderProps) {
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(() => Date.now())
  const [seconds, setSeconds] = useState<number | null>(null)

  const elapsed =
    // eslint-disable-next-line react-hooks/purity -- vendored: the clock is read in the render that turns done on
    seconds ?? Math.max(1, Math.round((Date.now() - started) / 1000))
  if (done && seconds === null) setSeconds(elapsed)
  if (!done && seconds !== null) {
    setSeconds(null)
    // eslint-disable-next-line react-hooks/purity -- vendored: restart the clock when work begins again
    setStarted(Date.now())
    setStep(0)
  }

  useEffect(() => {
    if (done || phase !== undefined || phases.length < 2) return
    const id = window.setInterval(() => {
      setStep((s) => (s + 1 < phases.length ? s + 1 : loop ? 0 : s))
    }, interval)
    return () => window.clearInterval(id)
  }, [done, phase, phases.length, interval, loop])

  const index = Math.min(
    Math.max(phase ?? step, 0),
    Math.max(phases.length - 1, 0)
  )
  const label = done
    ? typeof doneLabel === "function"
      ? doneLabel(elapsed)
      : doneLabel
    : (phases[index] ?? "")

  const [shown, setShown] = useState({ key: 0, text: label })
  const [leaving, setLeaving] = useState<{ key: number; text: string } | null>(
    null
  )
  if (label !== shown.text) {
    setLeaving(shown)
    setShown({ key: shown.key + 1, text: label })
  }

  const box = useRef<HTMLSpanElement>(null)
  const current = useRef<HTMLSpanElement>(null)
  const measured = useRef(false)
  useLayoutEffect(() => {
    const b = box.current
    const c = current.current
    if (!b || !c) return
    if (!measured.current) b.style.transition = "none"
    b.style.width = `${c.offsetWidth + LAYOUT_PIXEL_ROUNDING_PX}px`
    if (!measured.current) {
      b.getBoundingClientRect()
      b.style.transition = ""
      measured.current = true
    }
  }, [shown.key])

  return (
    <span
      data-slot="thinking-loader"
      className={["ui-tlc", className].filter(Boolean).join(" ")}
      data-size={size}
      data-variant={variant}
      data-done={done || undefined}
      role="status"
      aria-live="polite"
    >
      <style href="ui-thinking-loader-clean" precedence="default">
        {css}
      </style>

      <span className="ui-tlc__icon" aria-hidden="true">
        <svg className="ui-tlc__spinner" viewBox="0 0 16 16">
          {RAYS.map((i) => (
            <line
              key={i}
              x1="8"
              y1="1.75"
              x2="8"
              y2="4.75"
              transform={`rotate(${i * 45} 8 8)`}
              style={{ animationDelay: `${(i - 8) * 100}ms` }}
            />
          ))}
        </svg>
        <svg className="ui-tlc__check" viewBox="0 0 16 16">
          <path d="M3.5 8.4 6.6 11.3 12.5 4.9" pathLength={1} />
        </svg>
      </span>

      <span ref={box} className="ui-tlc__text">
        {leaving && (
          <span
            key={leaving.key}
            className="ui-tlc__label ui-tlc__label--out"
            aria-hidden="true"
            onAnimationEnd={() => setLeaving(null)}
          >
            {leaving.text}
          </span>
        )}
        <span
          key={shown.key}
          ref={current}
          className={[
            "ui-tlc__label",
            shown.key > 0 && "ui-tlc__label--in",
            !done && "ui-tlc__shine",
          ]
            .filter(Boolean)
            .join(" ")}
          data-text={shown.text}
        >
          {shown.text}
        </span>
      </span>
    </span>
  )
}
