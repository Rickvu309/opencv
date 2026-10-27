import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import "../landing.css"
import "./about.css"

import { LandingFooter } from "../landing-footer.tsx"
import { LandingNav } from "../landing-nav.tsx"
import { LandingClose } from "../landing-sections.tsx"
import {
  ABOUT_BELIEFS_TITLE,
  ABOUT_DESCRIPTION,
  ABOUT_HEADLINE,
  ABOUT_HOW_TITLE,
  ABOUT_LEDE,
  ABOUT_NEXT,
  ABOUT_PRINCIPLES,
  ABOUT_STORY,
  ABOUT_SURFACES,
  ABOUT_TITLE,
} from "./about-copy.ts"
import { AboutFigure } from "./about-figures.tsx"

export function AboutPage() {
  return (
    <div className="landing-root min-h-svh">
      <title>{ABOUT_TITLE}</title>
      <meta name="description" content={ABOUT_DESCRIPTION} />
      <LandingNav />
      <main className="landing-grid" aria-label="About">
        <section
          aria-labelledby="about-title"
          className="landing-section landing-stack about-open"
        >
          <h1 id="about-title" className="landing-section-title">
            {ABOUT_HEADLINE}
          </h1>
          <p className="landing-section-body about-lede">{ABOUT_LEDE}</p>
        </section>
        <section
          aria-labelledby="about-why"
          className="landing-section landing-stack"
        >
          <h2 id="about-why" className="landing-section-title">
            {ABOUT_STORY.title}
          </h2>
          <div className="about-prose">
            {ABOUT_STORY.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="about-believe"
          className="landing-section landing-stack"
        >
          <h2 id="about-believe" className="landing-section-title">
            {ABOUT_BELIEFS_TITLE}
          </h2>
          <div className="about-principles">
            {ABOUT_PRINCIPLES.map((principle) => (
              <article
                key={principle.id}
                className="about-principle landing-gradient"
              >
                <AboutFigure id={principle.id} label={principle.figure} />
                <h3>{principle.title}</h3>
                <p>{principle.line}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="about-how"
          className="landing-section landing-stack"
        >
          <h2 id="about-how" className="landing-section-title">
            {ABOUT_HOW_TITLE}
          </h2>
          <ul className="about-rows">
            {ABOUT_SURFACES.map((surface) => (
              <li key={surface.id} className="about-row">
                <h3>
                  <Link to="/" hash={surface.hash} className="about-row-link">
                    {surface.title}
                  </Link>
                </h3>
                <p>{surface.line}</p>
                <ArrowRight aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="about-next"
          className="landing-section landing-stack"
        >
          <h2 id="about-next" className="landing-section-title">
            {ABOUT_NEXT.title}
          </h2>
          <p className="landing-section-body">{ABOUT_NEXT.line}</p>
        </section>
        <LandingClose />
      </main>
      <LandingFooter />
    </div>
  )
}
