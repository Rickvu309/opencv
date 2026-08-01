import type { ProofTransformation } from "@/lib/types";

// Proof Builder (RDS-987): 7 seeded before-after transformation blocks
// spanning all 4 contexts (2 CV, 2 profile, 2 opportunity, 1 path). Each
// pairs a real weak claim or a real strong-but-unused Track Record entry
// (raw) with a grounded, evidence-backed rewrite (groundedProof) naming the
// exact entries behind it, one to two lines, honest confidence where the
// tie is a stretch. Accepting writes groundedProof to target and never
// applies itself first.
// Surface: /proof.
export const proofTransformations: ProofTransformation[] = [
  {
    id: "proof-1",
    contextType: "cv",
    contextRefId: "cv-1",
    raw: "Interaction design, design systems, user research, prototyping, stakeholder communication, accessibility design.",
    groundedProof:
      "Design systems and accessibility built to hold up under scale: rolled a shared design system across three squads, cutting new-screen build time by about a third, and wrote the accessibility audit checklist still required in every design review.",
    backingEntryIds: ["tre-3", "tre-8"],
    confidence: "High",
    target: { kind: "cv-section", cvId: "cv-1", sectionId: "cv-1-skills", sectionTitle: "Skills" },
    state: "proposed",
  },
  {
    id: "proof-2",
    contextType: "cv",
    contextRefId: "cv-3",
    raw: "Rebuilt the multi-step onboarding form after discovery research showed applicants dropping off at document upload.",
    groundedProof:
      "Also redesigned Fintra's loan-onboarding flow end to end after discovery research surfaced a document-upload drop-off point, cutting onboarding drop-off 18 percent quarter over quarter, the same discovery-to-metric rigor Meridian's evaluation console needs.",
    backingEntryIds: ["tre-2"],
    confidence: "Medium",
    target: { kind: "cv-section", cvId: "cv-3", sectionId: "cv-3-relevant-work", sectionTitle: "Relevant to this role" },
    state: "proposed",
  },
  {
    id: "proof-3",
    contextType: "profile",
    raw: "Senior product designer with nine years across fintech, e-commerce, and analytics tools. Spent the last three years designing the AI underwriting assistant at Fintra, and is now aiming for roles that blend AI product design with team leadership. Comfortable owning a problem from messy discovery through to a shipped, measurable outcome.",
    groundedProof:
      "Senior product designer with nine years across fintech, e-commerce, and analytics tools. Spent the last three years designing the AI underwriting assistant at Fintra, including the explainability panel that cut related support tickets 22 percent, and is now aiming for roles that blend AI product design with team leadership. Ran that same discovery-to-shipped-outcome arc at Loop Commerce too, where a three-squad design system rollout cut new-screen build time by about a third.",
    backingEntryIds: ["tre-1", "tre-3"],
    confidence: "High",
    target: { kind: "profile-summary" },
    state: "proposed",
  },
  {
    id: "proof-4",
    contextType: "profile",
    raw: "Coaches junior designers and facilitates cross-functional critique",
    groundedProof:
      "Mentored two designers into mid-level roles within twelve months through structured weekly one-on-ones and portfolio reviews, run alongside cross-squad critique at Loop Commerce.",
    backingEntryIds: ["tre-5"],
    confidence: "High",
    target: { kind: "profile-strength", strength: "Coaches junior designers and facilitates cross-functional critique" },
    state: "proposed",
  },
  {
    id: "proof-5",
    contextType: "opportunity",
    contextRefId: "opp-1",
    raw: "Defined checks for when the underwriting assistant should flag a low-confidence case for human review, working through edge cases with the data science team until the rule held up.",
    groundedProof:
      "The trust-boundary spec from Fintra's AI assistant discovery sprint, defining exactly what the model may decide on its own versus hand off to a human, is the direct precedent for Solace's clinical decision-support explainability layer.",
    backingEntryIds: ["tre-9"],
    confidence: "Medium",
    target: { kind: "opportunity-positioning", opportunityId: "opp-1" },
    state: "proposed",
  },
  {
    id: "proof-6",
    contextType: "opportunity",
    contextRefId: "opp-6",
    raw: "Panel prep note: leadership judgment is still the concern with the least direct evidence behind it going into Thursday's panel round.",
    groundedProof:
      "Mentored two designers into mid-level promotion within twelve months, direct leadership-judgment evidence for the panel round's harder questions, not just individual craft.",
    backingEntryIds: ["tre-5"],
    confidence: "High",
    target: { kind: "opportunity-positioning", opportunityId: "opp-6" },
    state: "proposed",
  },
  {
    id: "proof-7",
    contextType: "path",
    raw: "The AI explainability case study is still an outline, not a published write-up, three weeks out from its August 15 target.",
    groundedProof:
      "Publish the AI underwriting explainability case study, grounded in the 22 percent support-ticket reduction and the trust-boundary spec, before the next round of AI-forward applications.",
    backingEntryIds: ["tre-1", "tre-9"],
    confidence: "High",
    target: { kind: "path-plan-item" },
    state: "proposed",
  },
];
