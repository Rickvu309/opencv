import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Section } from "@workspace/ui/components/section"
import { TextReveal } from "@workspace/ui/components/text-reveal"
import { cn } from "@workspace/ui/lib/utils"

import "./landing.css"
import { LANDING_CTA, LANDING_SURFACES } from "./landing-copy.ts"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingHero } from "./landing-hero.tsx"
import { LandingNav } from "./landing-nav.tsx"
import { LandingPillars } from "./landing-pillars.tsx"
import { LandingSurfaceSection } from "./landing-surface.tsx"

export function LandingPage() {
  return (
    <div className="landing-root min-h-svh bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingPillars />
        {LANDING_SURFACES.map((surface) => (
          <LandingSurfaceSection key={surface.id} surface={surface} />
        ))}
        <Section aria-label="Get started">
          <Card className="items-center gap-8 bg-muted py-16 text-center shadow-none ring-0 md:py-24">
            <TextReveal
              as="p"
              text={LANDING_CTA}
              className="max-w-xl px-4 font-sans text-3xl font-medium tracking-tight text-balance md:text-4xl"
            />
            <Link
              to="/sign-up"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 px-5 text-base"
              )}
            >
              Start free
            </Link>
          </Card>
        </Section>
      </main>
      <LandingFooter />
    </div>
  )
}
