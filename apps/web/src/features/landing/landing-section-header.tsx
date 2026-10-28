import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { RevealText } from "./figures/oc/reveal.tsx"
import type { LandingSectionHeader as Header } from "./landing-copy.ts"

export function LandingSectionHeader({
  id,
  title,
  body,
  link,
}: Header & { id: string }) {
  return (
    <header className="landing-header landing-inset">
      <h2 id={id} className="landing-section-title">
        <RevealText text={title} />
      </h2>
      <div className="landing-header-main">
        <p className="landing-section-body">
          <RevealText text={body} delay={120} stagger={20} />
        </p>
        <Link
          to={link.to}
          data-strong
          className={cn("landing-link", FOCUS_RING)}
        >
          {link.label}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
