// Naming convention for the Copilot layer's one script registry (see
// lib/data/copilot-scripts.ts): an object gets its own forked surface only
// when its scripted content genuinely differs per instance (fit judgment per
// opportunity, tailoring guidance per CV). Everything else stays on the
// shared surface for its type. Kept dependency-free so both the script data
// and lib/copilot-utils.ts's runtime resolvers can import it without a
// circular import between the two.
export function opportunityForkedSurface(company: string): string {
  return `Opportunity Detail: ${company}`;
}

export function cvForkedSurface(cvName: string): string {
  return `CV Versions: ${cvName}`;
}
