import { LandingFigure } from "./figures/landing-figure.tsx"
import { RevealText } from "./figures/oc/reveal.tsx"
import { LANDING_HEADLINE_LINES, LANDING_SUBHEAD } from "./landing-copy.ts"

export function LandingHero() {
  return (
    <section id="hero" className="landing-hero" aria-labelledby="landing-hero">
      <div className="landing-hero-text landing-inset">
        <h1 id="landing-hero" className="landing-h1">
          <RevealText text={LANDING_HEADLINE_LINES.join("\n")} />
        </h1>
        <p className="landing-subhead">
          <RevealText text={LANDING_SUBHEAD} delay={200} />
        </p>
      </div>
      <div className="landing-panel landing-gradient" data-crop="hero">
        <LandingFigure id="apply-board" />
      </div>
    </section>
  )
}
