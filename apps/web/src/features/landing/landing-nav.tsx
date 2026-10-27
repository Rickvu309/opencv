import { documentHref } from "@/lib/web-origins-env.ts"
import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import { landingButton } from "./landing-button.ts"
import {
  LANDING_LOGIN_LABEL,
  LANDING_NAV_LINKS,
  LANDING_PRIMARY_LABEL,
  type LandingNavLink,
} from "./landing-copy.ts"

type NavHref = LandingNavLink["href"]

function pageHref(href: NavHref): Exclude<NavHref, `/#${string}`> | null {
  return href.startsWith("/#")
    ? null
    : (href as Exclude<NavHref, `/#${string}`>)
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
            {LANDING_NAV_LINKS.map((link) => {
              const page = pageHref(link.href)
              if (page) {
                return (
                  <Link
                    key={link.href}
                    to={page}
                    className={cn("landing-link", FOCUS_RING)}
                  >
                    {link.label}
                  </Link>
                )
              }
              return (
                <Link
                  key={link.href}
                  to="/"
                  hash={link.href.slice(2)}
                  className={cn("landing-link", FOCUS_RING)}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <div className="landing-nav-actions">
            <a
              href={documentHref("/sign-in")}
              className={cn("landing-link", FOCUS_RING)}
            >
              {LANDING_LOGIN_LABEL}
            </a>
            <a
              href={documentHref("/sign-in")}
              className={landingButton({ tone: "primary", size: "nav" })}
            >
              {LANDING_PRIMARY_LABEL}
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
