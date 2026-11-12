import "./landing.css"

import { LANDING_DESCRIPTION, LANDING_TITLE } from "./landing-copy.ts"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingHero } from "./landing-hero.tsx"
import { LandingNav } from "./landing-nav.tsx"
import { LandingIntegrations } from "./landing-integrations.tsx"
import { LandingProducts } from "./landing-products.tsx"
import {
  LandingBenefits,
  LandingClose,
  LandingCustomers,
  LandingLogos,
  LandingStatement,
} from "./landing-sections.tsx"

export function LandingPage() {
  return (
    <div className="landing-root landing-home min-h-svh">
      <title>{LANDING_TITLE}</title>
      <meta name="description" content={LANDING_DESCRIPTION} />
      <LandingNav />
      <main className="landing-grid">
        <LandingHero />
        <LandingLogos />
        <LandingStatement />
        <LandingBenefits />
        <LandingProducts />
        <LandingIntegrations />
        <LandingCustomers />
        <LandingClose />
      </main>
      <LandingFooter />
    </div>
  )
}
