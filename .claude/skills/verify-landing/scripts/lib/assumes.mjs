export const LANDING_DIR = "apps/web/src/features/landing"

export const SECTIONS = {
  Nav: "header.landing-nav",
  Hero: "#hero",
  Logos: "#logos",
  Statement: "#product",
  Benefits: "#benefits",
  "Paper Wrap": "#paper",
  "Apply Wrap": "#apply",
  "Coach Wrap": "#coach",
  "Integrations Wrap": "#integrations",
  "Coming next Wrap": "#coming-next",
  Customers: "#stories",
  Prefooter: "#close",
  "Footer Wrap": "footer",
}

export const SEL = {
  benefits: SECTIONS.Benefits,
  benefitCard: ".landing-benefit",
  benefitShot: ".landing-benefit-shot",
  close: SECTIONS.Prefooter,
  logos: SECTIONS.Logos,
  root: ".landing-root",
}

export const FILES = {
  spec: `${LANDING_DIR}/design/landing.spec.json`,
  styles: `${LANDING_DIR}/design/landing.styles.json`,
  omitted: `${LANDING_DIR}/design/landing.omitted.json`,
}

export const ASSUMES = {
  folders: [LANDING_DIR, `${LANDING_DIR}/design`],
  files: Object.values(FILES),
  routes: ["/"],
  apiPaths: [],
  selectors: [...new Set([...Object.values(SECTIONS), ...Object.values(SEL)])],
  markers: [],
}
