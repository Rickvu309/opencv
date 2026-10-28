import { LandingFigure } from "./figures/landing-figure.tsx"
import { LANDING_HEADLINE_LINES, LANDING_SUBHEAD } from "./landing-copy.ts"

export function LandingHero() {
  return (
    <section id="hero" className="landing-hero" aria-labelledby="landing-hero">
      <div className="landing-hero-text landing-inset">
        <h1 id="landing-hero" className="landing-h1">
          {LANDING_HEADLINE_LINES[0]} <br />
          {LANDING_HEADLINE_LINES[1]}
        </h1>
        <p className="landing-subhead">{LANDING_SUBHEAD}</p>
      </div>
      <div className="landing-panel landing-gradient" data-crop="hero">
        <LandingFigure id="apply-board" />
      </div>
    </section>
  )
}
