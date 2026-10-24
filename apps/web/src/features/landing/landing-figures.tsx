import "./landing-figures.css"

import { DispatchCard } from "./figures/dispatch-card.tsx"
import { PlotterCard } from "./figures/plotter-card.tsx"
import { ProofCard } from "./figures/proof-card.tsx"

export function LandingFigures() {
  return (
    <div className="landing-figures landing-frame py-4 md:py-8">
      <div className="landing-figures-grid">
        <ProofCard />
        <PlotterCard />
        <DispatchCard />
      </div>
    </div>
  )
}
