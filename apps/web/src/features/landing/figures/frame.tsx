import { useRef, type ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"

import type { MotionSpec } from "./model.ts"
import { useFigureMotion } from "./motion.ts"

const HINT = "Drag or use arrows"

type Stop = { value: number; label: string }

export function FigureCard({
  spec,
  readoutOf,
  apply,
  titleId,
  fig,
  instrument,
  heading,
  description,
  hint = HINT,
  stops,
  children,
}: {
  spec: MotionSpec
  readoutOf: (value: number) => string
  apply: (value: number) => void
  titleId: string
  fig: string
  instrument: string
  heading: string
  description: string
  hint?: string
  stops: readonly Stop[]
  children: ReactNode
}) {
  const wellRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLParagraphElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const motion = useFigureMotion(spec, readoutOf, apply, {
    well: wellRef,
    group: groupRef,
    readout: readoutRef,
    live: liveRef,
  })

  return (
    <section className="min-w-0" aria-labelledby={titleId}>
      <div
        ref={wellRef}
        className="relative aspect-[405/388] touch-pan-y overflow-hidden rounded-2xl bg-muted"
        onPointerEnter={motion.onPointerEnter}
        onPointerMove={motion.onPointerMove}
        onPointerDown={motion.onPointerDown}
        onPointerUp={motion.onPointerUp}
        onPointerLeave={motion.onPointerLeave}
        onPointerCancel={motion.onPointerCancel}
      >
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-3 text-[10px] tracking-[0.14em] text-foreground">
          <span>FIG.{fig}</span>
          <span className="uppercase">{instrument}</span>
        </div>
        {children}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <div
          ref={groupRef}
          role="group"
          aria-label={`${instrument}. ${hint}`}
          className="flex flex-wrap gap-1"
          onKeyDown={motion.onKeyDown}
          onFocus={motion.onFocus}
          onBlur={motion.onBlur}
        >
          {stops.map((stop) => (
            <Button
              key={stop.value}
              type="button"
              size="xs"
              variant={motion.stop === stop.value ? "secondary" : "outline"}
              aria-pressed={motion.stop === stop.value}
              data-stop={stop.value}
              tabIndex={motion.stop === stop.value ? 0 : -1}
              onClick={() => motion.commit(stop.value)}
            >
              {stop.label}
            </Button>
          ))}
        </div>
        <p
          ref={readoutRef}
          className="text-[11px] text-pretty text-foreground"
          aria-hidden="true"
        >
          {readoutOf(motion.stop)}
        </p>
        <p className="text-[10px] tracking-[0.14em] text-foreground">{hint}</p>
      </div>
      <p ref={liveRef} className="sr-only" aria-live="polite" />
      <h2
        id={titleId}
        className="mt-4 font-sans text-lg font-medium tracking-tight text-foreground"
      >
        {heading}
      </h2>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">
        {description}
      </p>
    </section>
  )
}
