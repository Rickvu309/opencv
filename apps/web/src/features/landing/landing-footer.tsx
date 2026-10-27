import { Link } from "@tanstack/react-router"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { OpenCvLogo } from "@/features/app-shell/app-logo.tsx"

import {
  LANDING_COPYRIGHT,
  LANDING_FOOTER,
  LANDING_TAGLINE_LINES,
} from "./landing-copy.ts"

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-grid">
        <div className="landing-inset">
          <div className="landing-footer-columns">
            <div className="landing-footer-brand">
              <Link to="/" className={cn("rounded-md", FOCUS_RING)}>
                <OpenCvLogo withWordmark />
              </Link>
              <p>
                {LANDING_TAGLINE_LINES[0]} <br />
                {LANDING_TAGLINE_LINES[1]}
              </p>
            </div>
            {LANDING_FOOTER.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p>{column.heading}</p>
                <ul>
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
          <p className="landing-footer-bottom">{LANDING_COPYRIGHT}</p>
        </div>
      </div>
    </footer>
  )
}
