import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import {
  LANDING_LOGIN_LABEL,
  LANDING_NAV_LINKS,
  LANDING_PRIMARY_LABEL,
} from "./landing-copy.ts"

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <header data-scrolled={scrolled} className="landing-nav">
      <div className="landing-grid">
        <div className="landing-bar landing-inset">
          <Link to="/" className={cn("rounded-md", FOCUS_RING)}>
            <OpenCvLogo
              withWordmark
              className="gap-2.25"
              wordmarkClassName="text-[16px] tracking-[-0.5px]"
            />
          </Link>
          <nav aria-label="Primary" className="landing-nav-links">
            {LANDING_NAV_LINKS.map((link) =>
              link.href.startsWith("/#") ? (
                <Link
                  key={link.href}
                  to="/"
                  hash={link.href.slice(2)}
                  className={cn("landing-link", FOCUS_RING)}
                >
                  {link.label}
                </Link>
              ) : (
                <Link
                  key={link.href}
                  to="/pricing"
                  className={cn("landing-link", FOCUS_RING)}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
          <div className="landing-nav-actions">
            <Link to="/sign-in" className={cn("landing-link", FOCUS_RING)}>
              {LANDING_LOGIN_LABEL}
            </Link>
            <Link
              to="/sign-in"
              className={cn(
                buttonVariants({ size: "sm" }),
                "landing-pill landing-gradient [padding-inline:0.75rem] [block-size:2.5rem]"
              )}
            >
              {LANDING_PRIMARY_LABEL}
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
