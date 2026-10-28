import { LandingFigure } from "./figures/landing-figure.tsx"
import {
  LANDING_COMING_NEXT,
  LANDING_COMING_NEXT_HEADER,
} from "./landing-copy.ts"
import { LandingSectionHeader } from "./landing-section-header.tsx"

export function LandingComingNext() {
  return (
    <section
      id="coming-next"
      aria-labelledby="coming-next-title"
      className="landing-wide"
      data-tight
    >
      <LandingSectionHeader
        id="coming-next-title"
        {...LANDING_COMING_NEXT_HEADER}
      />
      <div className="landing-cards">
        {LANDING_COMING_NEXT.map((item) => (
          <article key={item.id}>
            <div className="landing-card-panel landing-gradient">
              <LandingFigure id={item.figure} />
            </div>
            <div className="landing-card-text landing-inset">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
