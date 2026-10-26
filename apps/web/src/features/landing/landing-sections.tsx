import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@workspace/ui/components/button"
import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import {
  LANDING_CUSTOMERS_LABEL,
  LANDING_CUSTOMERS_LINE,
  LANDING_FEATURES,
  LANDING_LOGO_LABEL,
  LANDING_LOGOS,
  LANDING_PRIMARY_LABEL,
  LANDING_QUOTES,
  LANDING_SAMPLE_LABEL,
  LANDING_STATEMENT_LEAD,
  LANDING_STATEMENT_REST,
} from "./landing-copy.ts"
import { LandingFigures } from "./landing-figures.tsx"

export function LandingLogos() {
  return (
    <section
      id="logos"
      aria-labelledby="landing-logos"
      className="landing-section landing-stack landing-logos"
    >
      <ul className="landing-logo-row">
        {LANDING_LOGOS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <h2 id="landing-logos" className="landing-kicker">
        {LANDING_LOGO_LABEL}
      </h2>
    </section>
  )
}

export function LandingStatement() {
  return (
    <section
      id="product"
      aria-labelledby="product-statement"
      className="landing-section"
    >
      <p id="product-statement" className="landing-statement">
        <span className="text-foreground">{LANDING_STATEMENT_LEAD}</span>{" "}
        <span className="text-muted-foreground">{LANDING_STATEMENT_REST}</span>
      </p>
    </section>
  )
}

export function LandingBenefits() {
  return (
    <section id="benefits" aria-label="Benefits" className="landing-section">
      <div data-slot="landing-figures">
        <LandingFigures />
      </div>
    </section>
  )
}

export function LandingFeatures() {
  return (
    <>
      {LANDING_FEATURES.map((feature) => (
        <section
          key={feature.id}
          id={feature.id}
          aria-labelledby={`${feature.id}-title`}
          className="landing-section landing-stack"
        >
          <h2 id={`${feature.id}-title`} className="landing-section-title">
            {feature.title}
          </h2>
          <p className="landing-section-body">{feature.body}</p>
          <Link to="/sign-up" className={cn("landing-link", FOCUS_RING)}>
            Learn more
          </Link>
          <img
            src={feature.shot.src}
            alt={feature.shot.alt}
            width={feature.shot.width}
            height={feature.shot.height}
            loading="lazy"
            decoding="async"
            className="landing-shot"
          />
          <p className="text-sm font-medium">Features</p>
          <ul className="landing-chips">
            {feature.features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

export function LandingCustomers() {
  return (
    <section
      id="stories"
      aria-labelledby="stories-title"
      className="landing-section landing-stack"
    >
      <h2 id="stories-title" className="landing-section-title">
        {LANDING_CUSTOMERS_LABEL}
      </h2>
      <div className="landing-quote-grid">
        {LANDING_QUOTES.map((item) => (
          <figure key={item.name} className="landing-quote">
            <blockquote>
              <p>{item.quote}</p>
            </blockquote>
            <figcaption>
              <p className="text-[0.9375rem] font-medium">{item.name}</p>
              <p className="landing-quote-role text-sm">{item.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="landing-section-body">{LANDING_CUSTOMERS_LINE}</p>
    </section>
  )
}

export function LandingClose() {
  return (
    <section
      id="close"
      aria-label="Get started"
      data-align="center"
      className="landing-section landing-stack"
    >
      <p className="landing-close">
        Be the obvious hire. <br />
        Start today.
      </p>
      <div className="landing-close-actions">
        <Link
          to="/sign-up"
          className={cn(
            buttonVariants({ size: "lg" }),
            "rounded-full [padding-inline:1.25rem] [block-size:2.75rem]"
          )}
        >
          {LANDING_PRIMARY_LABEL}
        </Link>
        <Link to="/" hash="capture" className={cn("landing-link", FOCUS_RING)}>
          {LANDING_SAMPLE_LABEL}
        </Link>
      </div>
    </section>
  )
}
