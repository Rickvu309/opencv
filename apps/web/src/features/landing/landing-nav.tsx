import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import { LANDING_PRIMARY_LABEL, LANDING_SURFACES } from "./landing-copy.ts"

const NAV_LINK = cn(
  "landing-link inline-flex min-h-6 items-center rounded-md text-sm text-muted-foreground hover:text-foreground",
  FOCUS_RING
)

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <header
      data-scrolled={scrolled}
      className="fixed inset-x-0 top-0 z-40 border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-(--duration-micro) ease-out data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/80 data-[scrolled=true]:backdrop-blur-lg"
    >
      <div className="mx-auto flex w-full max-w-[1344px] flex-wrap items-center justify-between gap-x-6 px-4 md:h-16 md:flex-nowrap md:px-8">
        <Link to="/" className={cn("rounded-md py-4 md:py-0", FOCUS_RING)}>
          <OpenCvLogo withWordmark />
        </Link>
        <nav
          aria-label="Surfaces"
          className="order-last -mx-2 flex w-full items-center gap-2 pb-2 md:order-none md:w-auto md:gap-6 md:pb-0"
        >
          {LANDING_SURFACES.map((surface) => (
            <a
              key={surface.id}
              href={`#${surface.id}`}
              className={cn(NAV_LINK, "px-2 py-1.5 md:p-0")}
            >
              {surface.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/sign-in" className={NAV_LINK}>
            Sign in
          </Link>
          <Link
            to="/sign-up"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {LANDING_PRIMARY_LABEL}
          </Link>
        </div>
      </div>
    </header>
  )
}
