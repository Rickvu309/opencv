import type { ComponentType } from "react"

import { LANDING_BENEFITS, type LandingBenefit } from "./landing-copy.ts"
import { ApplicationsArt } from "./figures/applications-art.tsx"
import { CoachArt } from "./figures/coach-art.tsx"
import { CvArt } from "./figures/cv-art.tsx"

function BenefitCard({
  benefit,
  art: Art,
}: {
  benefit: LandingBenefit
  art: ComponentType
}) {
  return (
    <article className="landing-benefit">
      <div className="landing-benefit-shot">
        <Art />
      </div>
      <div className="landing-benefit-copy">
        <h2>{benefit.title}</h2>
        <p>{benefit.body}</p>
      </div>
    </article>
  )
}

export function LandingFigures() {
  return (
    <div className="landing-benefit-row">
      <BenefitCard benefit={LANDING_BENEFITS.cv} art={CvArt} />
      <BenefitCard
        benefit={LANDING_BENEFITS.applications}
        art={ApplicationsArt}
      />
      <BenefitCard benefit={LANDING_BENEFITS.coach} art={CoachArt} />
    </div>
  )
}
