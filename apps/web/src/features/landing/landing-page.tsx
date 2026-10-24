import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import "./landing.css"
import {
  LANDING_CTA,
  LANDING_PRIMARY_LABEL,
  LANDING_SUBHEAD,
  LANDING_SURFACES,
  LANDING_TITLE,
} from "./landing-copy.ts"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingHero } from "./landing-hero.tsx"
import { LandingNav } from "./landing-nav.tsx"
import { LandingSurfaceSection } from "./landing-surface.tsx"

export function LandingPage() {
  return (
    <div className="landing-root min-h-svh bg-background text-foreground">
      <title>{LANDING_TITLE}</title>
      <meta name="description" content={LANDING_SUBHEAD} />
      <LandingNav />
      <main>
        <LandingHero />
        {LANDING_SURFACES.map((surface) => (
          <LandingSurfaceSection key={surface.id} surface={surface} />
        ))}
        <section aria-label="Get started" className="py-16 md:py-32">
          <div className="mx-auto w-full max-w-[1344px] px-4 md:px-8">
            <Card className="items-center gap-8 bg-muted py-16 text-center shadow-none ring-0 md:py-24">
              <p className="max-w-xl px-4 font-sans text-3xl font-medium tracking-tight text-balance md:text-4xl">
                {LANDING_CTA}
              </p>
              <Link
                to="/sign-up"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 px-5 text-base"
                )}
              >
                {LANDING_PRIMARY_LABEL}
              </Link>
            </Card>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
