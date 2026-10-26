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
          <Link to="/sign-in" className={cn("landing-link", FOCUS_RING)}>
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
  const [maya, daniel] = LANDING_QUOTES

  return (
    <section
      id="stories"
      aria-labelledby="stories-title"
      className="landing-section landing-stack landing-stories"
    >
      <div className="landing-story-row">
        <figure className="landing-quote landing-quote-lead">
          <blockquote>
            <p>{maya.quote}</p>
          </blockquote>
          <div className="landing-portrait" role="img" aria-label="Maya T.">
            <span aria-hidden="true">MT</span>
          </div>
          <figcaption>
            <p className="text-[0.9375rem] font-medium">{maya.name}</p>
            <p className="landing-quote-role text-sm">{maya.role}</p>
          </figcaption>
        </figure>
        <figure className="landing-quote landing-quote-side">
          <blockquote>
            <p>{daniel.quote}</p>
          </blockquote>
          <figcaption>
            <p className="text-[0.9375rem] font-medium">{daniel.name}</p>
            <p className="landing-quote-role text-sm">{daniel.role}</p>
          </figcaption>
        </figure>
      </div>
      <div className="landing-story-foot">
        <p className="landing-customers-line">{LANDING_CUSTOMERS_LINE}</p>
        <h2 id="stories-title" className="landing-story-label">
          <span>{LANDING_CUSTOMERS_LABEL}</span>
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2.2 7h9.2M8.2 3.6 11.6 7 8.2 10.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </h2>
      </div>
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
          to="/sign-in"
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
