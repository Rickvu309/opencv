import { useRef, type ReactNode } from "react"
import { Pause, Play } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { MotionSpec } from "./model.ts"
import { useFigureMotion } from "./motion.ts"

export function FigureCard({
  spec,
  readoutOf,
  apply,
  titleId,
  heading,
  description,
  children,
}: {
  spec: MotionSpec
  readoutOf: (value: number) => string
  apply: (value: number) => void
  titleId: string
  heading: string
  description: string
  children: ReactNode
}) {
  const wellRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const descriptionId = `${titleId}-description`
  const motion = useFigureMotion(spec, readoutOf, apply, {
    well: wellRef,
    live: liveRef,
  })

  return (
    <section className="min-w-0" aria-labelledby={titleId}>
      <div className="relative">
        <div
          ref={wellRef}
          role="slider"
          tabIndex={0}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-valuemin={spec.min}
          aria-valuemax={spec.max}
          aria-valuenow={motion.stop}
          aria-valuetext={readoutOf(motion.stop)}
          className="relative aspect-[405/388] touch-pan-y overflow-hidden rounded-2xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onKeyDown={motion.onKeyDown}
          onFocus={motion.onFocus}
          onPointerEnter={motion.onPointerEnter}
          onPointerMove={motion.onPointerMove}
          onPointerDown={motion.onPointerDown}
          onPointerUp={motion.onPointerUp}
          onPointerLeave={motion.onPointerLeave}
          onPointerCancel={motion.onPointerCancel}
        >
          {children}
        </div>
        {motion.canPlay ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            className="absolute right-3 bottom-3"
            aria-label={`${motion.playing ? "Pause" : "Play"} animation: ${heading}`}
            onClick={motion.togglePlaying}
          >
            {motion.playing ? <Pause /> : <Play />}
          </Button>
        ) : null}
      </div>
      <p ref={liveRef} className="sr-only" aria-live="polite" />
      <h2
        id={titleId}
        className="mt-4 font-sans text-lg font-medium tracking-tight text-foreground"
      >
        {heading}
      </h2>
      <p
        id={descriptionId}
        className="mt-1 text-sm text-pretty text-muted-foreground"
      >
        {description}
      </p>
    </section>
  )
}
