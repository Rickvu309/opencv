import { Link } from "@tanstack/react-router"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import { LANDING_COPYRIGHT, type FooterColumn } from "./landing-copy.ts"

export function LandingFooter({
  columns,
  tagline,
}: {
  columns: readonly FooterColumn[]
  tagline?: string
}) {
  return (
    <footer className="landing-footer">
      <div className="landing-grid">
        <div className="landing-stack">
          <Link
            to="/"
            className={cn("rounded-md [inline-size:fit-content]", FOCUS_RING)}
          >
            <OpenCvLogo withWordmark />
          </Link>
          {tagline ? <p className="text-muted-foreground">{tagline}</p> : null}
          <div className="landing-footer-grid">
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p className="text-sm font-medium">{column.heading}</p>
                <ul className="landing-stack">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href === "/pricing" ? (
                        <Link
                          to="/pricing"
                          className={cn("landing-link", FOCUS_RING)}
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <Link
                          to="/"
                          hash={link.href.slice(2)}
                          className={cn("landing-link", FOCUS_RING)}
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{LANDING_COPYRIGHT}</p>
        </div>
      </div>
    </footer>
  )
}
