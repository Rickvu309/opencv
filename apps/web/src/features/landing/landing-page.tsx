import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import "./landing.css"
import {
  LANDING_CLOSE_LINES,
  LANDING_DESCRIPTION,
  LANDING_PRIMARY_LABEL,
  LANDING_STATEMENT_LEAD,
  LANDING_STATEMENT_REST,
  LANDING_SURFACES,
  LANDING_TITLE,
} from "./landing-copy.ts"
import { LandingFigures } from "./landing-figures.tsx"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingHero } from "./landing-hero.tsx"
import { LandingNav } from "./landing-nav.tsx"
import { LandingSurfaceSection } from "./landing-surface.tsx"

export function LandingPage() {
  return (
    <div className="landing-root min-h-svh bg-background text-foreground">
      <title>{LANDING_TITLE}</title>
      <meta name="description" content={LANDING_DESCRIPTION} />
      <LandingNav />
      <main>
        <LandingHero />
        <section
          id="product"
          aria-labelledby="product-statement"
          className="scroll-mt-32 py-16 md:scroll-mt-24 md:py-24 lg:py-32"
        >
          <div className="landing-frame">
            <p
              id="product-statement"
              className="landing-statement max-w-[1250px] text-pretty"
            >
              <span className="text-foreground">{LANDING_STATEMENT_LEAD}</span>{" "}
              <span className="text-muted-foreground">
                {LANDING_STATEMENT_REST}
              </span>
            </p>
          </div>
        </section>
        <div className="contents" data-slot="landing-figures">
          <LandingFigures />
        </div>
        {LANDING_SURFACES.map((surface) => (
          <LandingSurfaceSection key={surface.id} surface={surface} />
        ))}
        <section
          aria-label="Get started"
          className="pt-20 pb-20 md:pt-32 lg:pt-56 lg:pb-28"
        >
          <div className="landing-frame flex flex-col items-center text-center">
            <p className="landing-close max-w-3xl font-sans">
              {LANDING_CLOSE_LINES[0]} <br />
              {LANDING_CLOSE_LINES[1]}
            </p>
            <Link
              to="/sign-up"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 h-11 rounded-full px-5 text-base md:mt-10"
              )}
            >
              {LANDING_PRIMARY_LABEL}
            </Link>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
