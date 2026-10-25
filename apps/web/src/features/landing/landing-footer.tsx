import { Link } from "@tanstack/react-router"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import { LANDING_LOGIN_LABEL, LANDING_SURFACES } from "./landing-copy.ts"

const FOOTER_LINK = cn(
  "landing-link inline-flex min-h-10 items-center rounded-md text-sm text-muted-foreground hover:text-foreground md:min-h-8",
  FOCUS_RING
)

export function LandingFooter() {
  return (
    <footer className="border-t border-border pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="landing-frame grid gap-12 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-16">
        <Link to="/" className={cn("w-fit rounded-md", FOCUS_RING)}>
          <OpenCvLogo withWordmark />
        </Link>
        <nav aria-label="Footer" className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Product</p>
          {LANDING_SURFACES.map((surface) => (
            <a key={surface.id} href={`#${surface.id}`} className={FOOTER_LINK}>
              {surface.label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Account</p>
          <Link to="/sign-in" className={FOOTER_LINK}>
            {LANDING_LOGIN_LABEL}
          </Link>
        </div>
      </div>
    </footer>
  )
}
