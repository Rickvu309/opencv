import {
  LANDING_HEADLINE_LINES,
  LANDING_HERO_SHOT,
  LANDING_SUBHEAD,
} from "./landing-copy.ts"

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
        <img
          src={LANDING_HERO_SHOT.src}
          alt={LANDING_HERO_SHOT.alt}
          width={LANDING_HERO_SHOT.width}
          height={LANDING_HERO_SHOT.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="landing-screen"
        />
      </div>
    </section>
  )
}
