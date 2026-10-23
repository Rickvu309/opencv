import { Link } from "@tanstack/react-router"

import { SectionContainer } from "@workspace/ui/components/section"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import { LANDING_SURFACES } from "./landing-copy.ts"

const FOOTER_LINK = cn(
  "landing-link rounded-md text-sm text-muted-foreground hover:text-foreground",
  FOCUS_RING
)

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <SectionContainer className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <Link to="/" className={cn("w-fit rounded-md", FOCUS_RING)}>
          <OpenCvLogo withWordmark />
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
          {LANDING_SURFACES.map((surface) => (
            <a key={surface.id} href={`#${surface.id}`} className={FOOTER_LINK}>
              {surface.title}
            </a>
          ))}
          <Link to="/sign-in" className={FOOTER_LINK}>
            Sign in
          </Link>
        </nav>
      </SectionContainer>
    </footer>
  )
}
