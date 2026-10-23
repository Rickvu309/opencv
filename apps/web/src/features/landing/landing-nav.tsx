import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { SectionContainer } from "@workspace/ui/components/section"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import { LANDING_SURFACES } from "./landing-copy.ts"

const NAV_LINK = cn(
  "landing-link rounded-md text-sm text-muted-foreground hover:text-foreground",
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
      className="fixed inset-x-0 top-0 z-sticky border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-100 ease-out data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/80 data-[scrolled=true]:backdrop-blur-lg"
    >
      <SectionContainer className="flex h-16 items-center justify-between gap-6">
        <Link to="/" className={cn("rounded-md", FOCUS_RING)}>
          <OpenCvLogo withWordmark />
        </Link>
        <nav
          aria-label="Surfaces"
          className="hidden items-center gap-6 md:flex"
        >
          {LANDING_SURFACES.map((surface) => (
            <a key={surface.id} href={`#${surface.id}`} className={NAV_LINK}>
              {surface.title}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/sign-in" className={NAV_LINK}>
            Sign in
          </Link>
          <Link
            to="/sign-up"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Start free
          </Link>
        </div>
      </SectionContainer>
    </header>
  )
}
