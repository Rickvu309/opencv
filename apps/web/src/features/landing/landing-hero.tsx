import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { Section } from "@workspace/ui/components/section"
import { cn } from "@workspace/ui/lib/utils"

import {
  LANDING_HEADLINE,
  LANDING_HERO_SHOT,
  LANDING_SUBHEAD,
} from "./landing-copy.ts"
import { LandingShot } from "./landing-surface.tsx"

const CTA = "h-11 w-full px-5 text-base sm:w-auto"

export function LandingHero() {
  return (
    <Section className="pt-28 pb-0 md:pt-40 md:pb-0">
      <h1 className="landing-h1 max-w-3xl font-sans">{LANDING_HEADLINE}</h1>
      <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
        {LANDING_SUBHEAD}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/sign-up" className={cn(buttonVariants({ size: "lg" }), CTA)}>
          Start free
        </Link>
        <Link
          to="/sign-in"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            CTA
          )}
        >
          Sign in
        </Link>
      </div>
      <div className="mt-16 md:mt-20">
        <LandingShot shot={LANDING_HERO_SHOT} priority />
      </div>
    </Section>
  )
}
