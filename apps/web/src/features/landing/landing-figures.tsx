import "./landing-figures.css"

import { LANDING_BENEFITS } from "./landing-copy.ts"
import { DispatchCard } from "./figures/dispatch-card.tsx"
import { PlotterCard } from "./figures/plotter-card.tsx"
import { ProofCard } from "./figures/proof-card.tsx"

export function LandingFigures() {
  return (
    <div className="landing-figures">
      <div className="landing-benefit-row">
        <PlotterCard benefit={LANDING_BENEFITS.cv} />
        <DispatchCard benefit={LANDING_BENEFITS.applications} />
        <ProofCard benefit={LANDING_BENEFITS.coach} />
      </div>
    </div>
  )
}
