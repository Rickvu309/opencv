import {
  LANDING_CHAIR,
  LANDING_HEADLINE_LINES,
  LANDING_SUBHEAD,
} from "./landing-copy.ts"

export function LandingHero() {
  return (
    <section id="hero" className="landing-hero" aria-labelledby="landing-hero">
      <h1 id="landing-hero" className="landing-h1">
        {LANDING_HEADLINE_LINES[0]} <br />
        {LANDING_HEADLINE_LINES[1]}
      </h1>
      <p className="landing-subhead">{LANDING_SUBHEAD}</p>
      <img
        src={LANDING_CHAIR.src}
        alt={LANDING_CHAIR.alt}
        width={LANDING_CHAIR.width}
        height={LANDING_CHAIR.height}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="landing-hero-photo"
      />
    </section>
  )
}
