import { documentHref } from "@/lib/web-origins-env.ts"
import { Link } from "@tanstack/react-router"

import { OpenCvMark } from "@/features/app-shell/app-logo.tsx"

import { landingButton } from "./landing-button.ts"

import {
  LANDING_CUSTOMERS_LABEL,
  LANDING_CUSTOMERS_LINE,
  LANDING_LOGO_LABEL,
  LANDING_LOGOS,
  LANDING_PRIMARY_LABEL,
  LANDING_STORIES,
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
        <OpenCvMark className="landing-statement-mark" />{" "}
        <span className="landing-statement-rest">{LANDING_STATEMENT_REST}</span>
      </p>
    </section>
  )
}

export function LandingBenefits() {
  return (
    <section
      id="benefits"
      aria-label="Benefits"
      className="landing-section landing-benefits"
    >
      <div data-slot="landing-figures">
        <LandingFigures />
      </div>
    </section>
  )
}

export function LandingCustomers() {
  const { lead, side } = LANDING_STORIES

  return (
    <section
      id="stories"
      aria-labelledby="stories-title"
      className="landing-section landing-stack landing-stories"
    >
      <h2 id="stories-title" className="sr-only">
        {LANDING_CUSTOMERS_LABEL}
      </h2>
      <div className="landing-story-row">
        <figure
          className="landing-quote landing-quote-lead landing-gradient"
          data-soft
        >
          <div className="landing-quote-body">
            <blockquote>
              <p>{lead.quote}</p>
            </blockquote>
            <figcaption>
              <p className="text-[0.9375rem] font-medium">{lead.name}</p>
              <p className="landing-quote-role text-sm">{lead.role}</p>
            </figcaption>
          </div>
          <img
            src={lead.photo.src}
            alt={lead.photo.alt}
            width={lead.photo.width}
            height={lead.photo.height}
            loading="lazy"
            decoding="async"
            className="landing-quote-photo"
          />
        </figure>
        <figure className="landing-quote landing-quote-side">
          <blockquote>
            <p>{side.quote}</p>
          </blockquote>
          <figcaption className="landing-quote-person">
            <img
              src={side.photo.src}
              alt={side.photo.alt}
              width={side.photo.width}
              height={side.photo.height}
              loading="lazy"
              decoding="async"
              className="landing-quote-avatar"
            />
            <div>
              <p className="text-[0.9375rem] font-medium">{side.name}</p>
              <p className="landing-quote-role text-sm">{side.role}</p>
            </div>
          </figcaption>
        </figure>
      </div>
      <div className="landing-story-foot">
        <p className="landing-customers-line">{LANDING_CUSTOMERS_LINE}</p>
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
        <a
          href={documentHref("/sign-in")}
          className={landingButton({ tone: "primary", size: "close" })}
        >
          {LANDING_PRIMARY_LABEL}
        </a>
        <Link
          to="/"
          hash="paper"
          className={landingButton({ tone: "quiet", size: "close" })}
        >
          {LANDING_SAMPLE_LABEL}
        </Link>
      </div>
    </section>
  )
}
