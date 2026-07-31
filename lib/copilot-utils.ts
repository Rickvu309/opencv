import { copilotScripts } from "@/lib/data/copilot-scripts";
import { cvForkedSurface, opportunityForkedSurface } from "@/lib/copilot-surface-names";

/** The surface to set when opening the panel for a given opportunity: its own scripted surface if one exists, otherwise the shared fallback. */
export function resolveOpportunitySurface(company: string): string {
  const forked = opportunityForkedSurface(company);
  return copilotScripts.some((script) => script.surface === forked) ? forked : "Opportunity Detail";
}

/** The surface to set when opening the panel for a given CV version: its own scripted surface if one exists, otherwise the shared "CV Versions" surface. */
export function resolveCvSurface(cvName: string): string {
  const forked = cvForkedSurface(cvName);
  return copilotScripts.some((script) => script.surface === forked) ? forked : "CV Versions";
}

// Short category shown in the panel's context chip, keyed off the surface's
// base name (the part before any ":" fork). Falls back to the surface
// string itself so a future surface never renders blank.
const CONTEXT_CHIP_CATEGORY: Record<string, string> = {
  Home: "Home",
  Opportunities: "Opportunities",
  "Opportunity Detail": "Opportunity",
  Profile: "Profile",
  "CV Versions": "CV",
  "Track Record": "Track Record",
  Goals: "Goals",
  "Skills & Learning": "Skills",
  Rewind: "Rewind",
  Roadmap: "Roadmap",
};

/** Builds the panel header's context chip text, for example "Opportunity: AI Product Designer at Metriq" or plain "Skills" on an index page. */
export function getCopilotContextChip(surface: string, objectLabel?: string): string {
  const base = surface.split(":")[0].trim();
  const category = CONTEXT_CHIP_CATEGORY[base] ?? base;
  return objectLabel ? `${category}: ${objectLabel}` : category;
}
