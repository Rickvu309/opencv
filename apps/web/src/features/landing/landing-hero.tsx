import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import {
  LANDING_HEADLINE,
  LANDING_HERO_SHOT,
  LANDING_OBJECTION,
  LANDING_PRIMARY_LABEL,
  LANDING_SUBHEAD,
} from "./landing-copy.ts"
import { LandingShot } from "./landing-surface.tsx"

export function LandingHero() {
  return (
    <section className="pt-28 pb-0">
      <div className="mx-auto w-full max-w-[1344px] px-4 md:px-8">
        <h1 className="landing-h1 max-w-4xl font-sans">{LANDING_HEADLINE}</h1>
        <p className="mt-5 max-w-3xl text-base text-pretty text-muted-foreground md:text-lg">
          {LANDING_SUBHEAD}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link
            to="/sign-up"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 px-5 text-base"
            )}
          >
            {LANDING_PRIMARY_LABEL}
          </Link>
          <Link
            to="/sign-in"
            className={cn(
              "landing-link inline-flex h-11 items-center rounded-md px-1 text-base text-muted-foreground hover:text-foreground",
              FOCUS_RING
            )}
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 max-w-xl text-sm text-pretty text-muted-foreground">
          {LANDING_OBJECTION}
        </p>
        <div className="mt-8 md:mt-10">
          <LandingShot shot={LANDING_HERO_SHOT} priority />
        </div>
      </div>
    </section>
  )
}
