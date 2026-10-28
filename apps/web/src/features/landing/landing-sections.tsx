import { documentHref } from "@/lib/web-origins-env.ts"
import { Link } from "@tanstack/react-router"

import { OpenCvMark } from "@/features/app-shell/app-logo.tsx"

import { LogoMarquee } from "./figures/oc/logo-marquee.tsx"
import { Reveal, RevealText } from "./figures/oc/reveal.tsx"
import { landingButton } from "./landing-button.ts"

import {
  LANDING_CUSTOMERS_LABEL,
  LANDING_CUSTOMERS_LINE,
  LANDING_LOGO_LABEL,
  LANDING_PRIMARY_LABEL,
  LANDING_STORIES,
  LANDING_SAMPLE_LABEL,
  LANDING_STATEMENT_BRAND,
  LANDING_STATEMENT_LEAD,
  LANDING_STATEMENT_REST,
} from "./landing-copy.ts"
import { LandingFigures } from "./landing-figures.tsx"

const wordCount = (text: string) => text.split(/\s+/).length
const STATEMENT_STAGGER = 45
const LEAD_WORDS = wordCount(LANDING_STATEMENT_LEAD)
const BRAND_WORDS = wordCount(LANDING_STATEMENT_BRAND)

export function LandingLogos() {
  return (
    <section
      id="logos"
      aria-labelledby="landing-logos"
      className="landing-section landing-stack landing-logos"
    >
      <LogoMarquee />
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
        <RevealText className="text-foreground" text={LANDING_STATEMENT_LEAD} />{" "}
        <OpenCvMark className="landing-statement-mark" />{" "}
        <RevealText
          className="landing-statement-rest"
          text={LANDING_STATEMENT_BRAND}
          delay={LEAD_WORDS * STATEMENT_STAGGER}
        />{" "}
        <br className="landing-statement-break" />
        <RevealText
          className="landing-statement-rest"
          text={LANDING_STATEMENT_REST}
          delay={(LEAD_WORDS + BRAND_WORDS) * STATEMENT_STAGGER}
        />
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
        <Link to="/stories" className="landing-link">
          Read all stories
        </Link>
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
        <RevealText text={"Be the obvious hire.\nStart today."} />
      </p>
      <Reveal className="landing-close-actions" delay={300}>
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
      </Reveal>
    </section>
  )
}
