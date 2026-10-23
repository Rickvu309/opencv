import { Card } from "@workspace/ui/components/card"
import { Section } from "@workspace/ui/components/section"
import { cn } from "@workspace/ui/lib/utils"

import type { LandingSurface } from "./landing-copy.ts"

type Shot = LandingSurface["shot"]

export function LandingShot({
  shot,
  priority = false,
}: {
  shot: Shot
  priority?: boolean
}) {
  return (
    <Card className="landing-fade gap-0 rounded-b-none border border-b-0 border-border py-0 shadow-none ring-0">
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet={shot.mobileSrc}
          width={shot.mobileWidth}
          height={shot.mobileHeight}
        />
        <img
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className={cn("block h-auto w-full", priority && "landing-reveal")}
        />
      </picture>
    </Card>
  )
}

export function LandingSurfaceSection({
  surface,
}: {
  surface: LandingSurface
}) {
  const headingId = `${surface.id}-title`

  return (
    <Section
      id={surface.id}
      aria-labelledby={headingId}
      className="scroll-mt-16"
    >
      <div className="mb-10 grid gap-4 md:mb-16 md:grid-cols-2 md:items-end md:gap-8">
        <h2
          id={headingId}
          className="font-sans text-3xl font-medium tracking-tight text-balance md:text-4xl"
        >
          {surface.title}
        </h2>
        <p className="max-w-md text-base text-pretty text-muted-foreground md:text-lg">
          {surface.body}
        </p>
      </div>
      <LandingShot shot={surface.shot} />
    </Section>
  )
}
