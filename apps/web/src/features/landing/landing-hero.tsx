import {
  LANDING_CHAIR,
  LANDING_HEADLINE_LINES,
  LANDING_SUBHEAD,
} from "./landing-copy.ts"

export function LandingHero() {
  return (
    <section className="pt-16 md:pt-28 lg:pt-40">
      <div className="landing-frame">
        <h1 className="landing-h1 max-w-3xl text-left font-sans">
          {LANDING_HEADLINE_LINES[0]} <br />
          {LANDING_HEADLINE_LINES[1]}
        </h1>
        <p className="mt-8 max-w-3xl text-base leading-6 text-pretty text-muted-foreground">
          {LANDING_SUBHEAD}
        </p>
        <img
          src={LANDING_CHAIR.src}
          alt={LANDING_CHAIR.alt}
          width={LANDING_CHAIR.width}
          height={LANDING_CHAIR.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="mt-16 aspect-[7/4] w-full rounded-2xl border border-border object-cover object-[center_58%] md:mt-20"
        />
      </div>
    </section>
  )
}
