import {
  LANDING_INTEGRATIONS,
  LANDING_INTEGRATIONS_HEADER,
} from "./landing-copy.ts"
import { LandingSectionHeader } from "./landing-section-header.tsx"

export function LandingIntegrations() {
  if (LANDING_INTEGRATIONS.length === 0) return null

  return (
    <section
      id="integrations"
      aria-labelledby="integrations-title"
      className="landing-wide"
    >
      <LandingSectionHeader
        id="integrations-title"
        {...LANDING_INTEGRATIONS_HEADER}
      />
      <ul className="landing-tiles landing-inset">
        {LANDING_INTEGRATIONS.map((app) => (
          <li key={app.id} className="landing-tile">
            <img
              src={app.src}
              alt={app.name}
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
