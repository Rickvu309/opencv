import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import type { LandingSurface, Shot } from "./landing-copy.ts"

export function LandingShot({
  shot,
  priority = false,
}: {
  shot: Shot
  priority?: boolean
}) {
  return (
    <Card
      style={{ maxWidth: shot.displayWidth }}
      className={cn(
        "mx-auto gap-0 border border-border py-0 shadow-none ring-0",
        priority ? "overflow-hidden" : "landing-fade rounded-b-none border-b-0"
      )}
    >
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
          className="block h-auto w-full"
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
    <section
      id={surface.id}
      aria-labelledby={headingId}
      className="scroll-mt-28 py-12 md:scroll-mt-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1344px] px-4 md:px-8">
        <div className="mb-10 grid gap-4 md:mb-16 md:grid-cols-2 md:items-end md:gap-8">
          <h2
            id={headingId}
            className="font-sans text-3xl font-medium tracking-tight text-balance md:text-4xl"
          >
            <span className="mb-3 block text-sm font-medium tracking-normal text-muted-foreground">
              {surface.label}
              <span className="sr-only">. </span>
            </span>
            {surface.title}
          </h2>
          <p className="max-w-md text-base text-pretty text-muted-foreground md:text-lg">
            {surface.body}
          </p>
        </div>
        <LandingShot shot={surface.shot} />
      </div>
    </section>
  )
}
