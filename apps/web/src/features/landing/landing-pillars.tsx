import { Section } from "@workspace/ui/components/section"
import { Separator } from "@workspace/ui/components/separator"
import { Fragment } from "react"

import { LANDING_PILLARS } from "./landing-copy.ts"

export function LandingPillars() {
  return (
    <Section
      aria-label="What OpenCV does"
      className="py-12 md:py-16"
      containerClassName="grid gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-10"
    >
      {LANDING_PILLARS.map((pillar, index) => (
        <Fragment key={pillar.title}>
          {index > 0 ? (
            <Separator orientation="vertical" className="hidden md:block" />
          ) : null}
          <div className="space-y-2">
            <p className="text-base font-medium">{pillar.title}</p>
            <p className="text-sm text-pretty text-muted-foreground">
              {pillar.body}
            </p>
          </div>
        </Fragment>
      ))}
    </Section>
  )
}
