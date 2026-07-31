import type { ConfidenceLevel, FitLevel, OpportunityStatus } from "@/lib/types";

// Canned "Parse with Copilot" results for the Add opportunity paste path.
// Copilot picks one of these by a simple keyword match on the pasted text,
// and falls back to the first entry when nothing matches. Every sample
// leaves one field unfilled on purpose, so the structured preview can show
// a "Copilot suggests adding this" hint instead of an error.
export interface ParseSample {
  id: string;
  keywords: string[];
  role: string;
  company: string;
  location: string;
  salaryRange: string;
  source: string;
  status: OpportunityStatus;
  notes: string;
  tags: string[];
  fit: FitLevel;
  fitRationale: string;
  confidence: ConfidenceLevel;
}

export const parseSamples: ParseSample[] = [
  {
    id: "parse-ai-product-designer",
    keywords: ["linkedin", "ai product designer", "copilot", "enterprise"],
    role: "AI Product Designer",
    company: "Lucent Cognition",
    location: "Remote (US hours)",
    salaryRange: "$130,000 to $160,000 USD",
    source: "Pasted from LinkedIn",
    status: "Saved",
    notes: "",
    tags: ["AI product", "Enterprise", "Remote"],
    fit: "Strong",
    fitRationale:
      "Prompt and interaction design for an enterprise copilot overlaps closely with the assistant work Mai already ships at Fintra.",
    confidence: "High",
  },
  {
    id: "parse-startup-note",
    keywords: ["startup", "pre-seed", "founding designer", "small team", "meetup"],
    role: "Product Designer (founding)",
    company: "Saola Labs",
    location: "Ho Chi Minh City (hybrid, flexible)",
    salaryRange: "",
    source: "Pasted rough notes",
    status: "Saved",
    notes:
      "Heard about this through a friend from a design meetup. Pre-seed, team of four, would be the first dedicated design hire.",
    tags: ["Early-stage", "Generalist"],
    fit: "Medium",
    fitRationale:
      "A founding-designer scope matches Mai's move toward leadership, though the early-stage generalist range is a stretch from her current depth.",
    confidence: "Medium",
  },
  {
    id: "parse-design-lead-url",
    keywords: ["http", "www", ".com/careers", ".com/jobs", "design lead"],
    role: "Design Lead, Developer Platform",
    company: "Vertex Cloud",
    location: "",
    salaryRange: "$145,000 to $175,000 USD",
    source: "Pasted job link",
    status: "Saved",
    notes:
      "Leads design for the developer-facing dashboard and the CLI onboarding flow, reporting to the Head of Platform.",
    tags: ["Leadership", "Developer tools", "Remote"],
    fit: "Medium",
    fitRationale:
      "The leadership scope fits Mai's target direction, but developer-tooling has less direct overlap with her fintech and AI work than her strongest matches.",
    confidence: "Medium",
  },
];

/**
 * Picks a canned parse sample by simple keyword match on the pasted input,
 * case-insensitive. Defaults to the first sample when nothing matches.
 */
export function matchParseSample(input: string): ParseSample {
  const normalized = input.toLowerCase();
  const matched = parseSamples.find((sample) =>
    sample.keywords.some((keyword) => normalized.includes(keyword))
  );
  return matched ?? parseSamples[0];
}
