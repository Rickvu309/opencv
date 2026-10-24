import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import {
  LANDING_AUTH_LINKS,
  LANDING_NAV_ANCHORS,
  type LandingLink,
} from "./landing-copy.ts"

const NAV_LINK = cn(
  "landing-link inline-flex min-h-8 items-center rounded-full px-1.5 text-xs text-muted-foreground hover:text-foreground md:px-3 md:text-sm",
  FOCUS_RING
)

function LandingNavLink({ link }: { link: LandingLink }) {
  if (link.kind === "anchor") {
    return (
      <a href={link.href} className={NAV_LINK}>
        {link.label}
      </a>
    )
  }

  if (link.to === "/sign-up") {
    return (
      <Link
        to={link.to}
        className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-full px-3")}
      >
        {link.label}
      </Link>
    )
  }

  return (
    <Link to={link.to} className={NAV_LINK}>
      {link.label}
    </Link>
  )
}

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
      className="landing-nav sticky top-0 z-40 border-b border-transparent bg-background data-[scrolled=true]:border-border"
    >
      <div className="landing-frame flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 md:h-16 md:flex-nowrap md:py-0">
        <Link to="/" className={cn("rounded-md py-1", FOCUS_RING)}>
          <OpenCvLogo withWordmark />
        </Link>
        <nav
          aria-label="Primary"
          className="order-last -mx-2 flex w-full flex-wrap items-center gap-x-1 gap-y-1 md:order-none md:mx-0 md:w-auto"
        >
          {LANDING_NAV_ANCHORS.map((anchor) => (
            <LandingNavLink key={anchor.href} link={anchor} />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {LANDING_AUTH_LINKS.map((link) => (
            <LandingNavLink key={link.to} link={link} />
          ))}
        </div>
      </div>
    </header>
  )
}
