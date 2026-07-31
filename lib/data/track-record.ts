import type { TrackRecordEntry } from "@/lib/types";

// The closed vocabulary for the evidence tag: what kind of proof backs the
// entry, not what kind of achievement it was. Shown as a Select in both the
// manual add dialog and the candidate confirm dialog.
export const EVIDENCE_TAGS = [
  "Case study",
  "Metric",
  "Reference quote",
  "Recognition",
  "Artifact",
] as const;

export type EvidenceTag = (typeof EVIDENCE_TAGS)[number];

// 10 confirmed entries plus 2 unconfirmed AI-drafted candidates.
export const trackRecordEntries: TrackRecordEntry[] = [
  {
    id: "tre-1",
    title: "Shipped the AI underwriting explainability panel",
    story:
      "Designed the panel that shows loan applicants why the AI underwriting assistant reached its decision, working with data science to translate model factors into plain language.",
    impact: "Reduced underwriting-decision support tickets by 22 percent in the first quarter after launch.",
    date: "2024-11-08",
    evidenceTag: "Case study",
    evidenceNote: "Written up as a full case study, screenshots and before-and-after ticket volume included.",
    skillIds: ["skill-5", "skill-1"],
    status: "confirmed",
    usedIn: [
      { kind: "cv", id: "cv-3", label: "Meridian Labs, tailored" },
      { kind: "cv", id: "cv-1", label: "Base CV" },
    ],
    strengthens: "Land a senior or staff AI product design role, the headline proof point behind the Meridian Labs and Solace AI applications.",
  },
  {
    id: "tre-2",
    title: "Redesigned the loan-onboarding form flow",
    story:
      "Rebuilt the multi-step onboarding form after discovery research showed applicants dropping off at document upload.",
    impact: "Cut onboarding drop-off by 18 percent quarter over quarter.",
    date: "2023-09-14",
    evidenceTag: "Metric",
    evidenceNote: "Drop-off rate tracked in the product analytics dashboard, before and after the redesign shipped.",
    skillIds: ["skill-1", "skill-3"],
    status: "confirmed",
    strengthens: "Arclight AI's Applied-stage application, evidence of measurable impact from research-driven redesign work.",
  },
  {
    id: "tre-3",
    title: "Rolled out a shared design system across three squads",
    story:
      "Led the migration of three separate component libraries into one shared system, including a contribution model for squad-level additions.",
    impact: "Cut new-screen build time by roughly a third across the squads that adopted it.",
    date: "2021-10-02",
    evidenceTag: "Metric",
    evidenceNote: "Build-time comparison pulled from squad delivery logs before and after adoption.",
    skillIds: ["skill-2", "skill-10"],
    status: "confirmed",
    usedIn: [{ kind: "cv", id: "cv-2", label: "Product-lead CV" }],
    strengthens: "Grow into people leadership, the cross-squad leadership evidence anchoring the Product-lead CV.",
  },
  {
    id: "tre-4",
    title: "Established the first structured usability testing program",
    story:
      "Set up recruiting, screener design, and a shared synthesis template so usability testing could run every sprint instead of ad hoc.",
    impact: "Usability sessions went from roughly one per quarter to weekly, with findings tracked against a shared backlog.",
    date: "2019-06-20",
    evidenceTag: "Artifact",
    evidenceNote: "The recruiting checklist and synthesis template are still in use, both kept as reference artifacts.",
    skillIds: ["skill-3"],
    status: "confirmed",
    strengthens: "Grow into people leadership, your first evidence of running a program rather than a single project.",
  },
  {
    id: "tre-5",
    title: "Mentored two designers into mid-level roles",
    story:
      "Ran structured weekly one-on-ones and portfolio reviews with two junior designers over a year, focused on critique skills and case-study writing.",
    impact: "Both designers were promoted to mid-level within twelve months.",
    date: "2025-01-15",
    evidenceTag: "Reference quote",
    evidenceNote: "Both designers offered to give a reference on the mentoring specifically if a hiring panel asks.",
    skillIds: ["skill-8", "skill-10"],
    status: "confirmed",
    usedIn: [{ kind: "cv", id: "cv-2", label: "Product-lead CV" }],
    strengthens: "Grow into people leadership, the direct evidence Brightpath Bank's panel probed hardest.",
  },
  {
    id: "tre-6",
    title: "Presented the design system rollout at a regional UX meetup",
    story:
      "Gave a talk on the design system migration and contribution model to roughly 80 attendees at a Ho Chi Minh City UX meetup.",
    impact: "Talk led to two cross-company design system working sessions afterward.",
    date: "2022-03-11",
    evidenceTag: "Recognition",
    evidenceNote: "Invited back to co-host one of the follow-up working sessions, slide deck kept for reference.",
    skillIds: ["skill-12", "skill-2"],
    status: "confirmed",
    strengthens: "Build a public design writing habit, the one existing proof point that public speaking already works for you.",
  },
  {
    id: "tre-7",
    title: "Redesigned seller-tools checkout",
    story:
      "Reworked the seller-facing checkout and payout flow after support ticket analysis showed confusion around payout timing.",
    impact: "Cut related support tickets by 25 percent within two months of launch.",
    date: "2022-06-30",
    evidenceTag: "Metric",
    evidenceNote: "Support ticket volume pulled from the help-desk dashboard, tagged by category before and after launch.",
    skillIds: ["skill-1", "skill-7"],
    status: "confirmed",
    strengthens: "The data-storytelling evidence behind your Strong fit read on Arclight AI.",
  },
  {
    id: "tre-8",
    title: "Built the first company-wide accessibility audit checklist",
    story:
      "Wrote and piloted an accessibility checklist covering contrast, focus order, and screen-reader labeling, then rolled it into the design review process.",
    impact: "Adopted as a required review step for all new screens across the product org.",
    date: "2024-05-02",
    evidenceTag: "Artifact",
    evidenceNote: "The checklist itself is still the version in active use, kept as a reference artifact.",
    skillIds: ["skill-11"],
    status: "confirmed",
    strengthens: "The design-process rigor evidence supporting your portfolio case study on AI explainability.",
  },
  {
    id: "tre-9",
    title: "Led the discovery sprint for the AI assistant concept",
    story:
      "Ran a five-day discovery sprint with data science and compliance to scope what the AI underwriting assistant should and should not decide on its own.",
    impact: "Sprint output became the trust-boundary spec the assistant still ships against.",
    date: "2023-05-19",
    evidenceTag: "Artifact",
    evidenceNote: "The trust-boundary spec from this sprint is still the reference document data science cites today.",
    skillIds: ["skill-5", "skill-6", "skill-9"],
    status: "confirmed",
    usedIn: [
      { kind: "cv", id: "cv-3", label: "Meridian Labs, tailored" },
      { kind: "opportunity", id: "opp-6", label: "Meridian Labs (Interview)" },
    ],
    strengthens: "Land a senior or staff AI product design role directly, the trust-boundary framing runs through every AI-forward application this year.",
  },
  {
    id: "tre-10",
    title: "Shipped an agency client mobile redesign",
    story:
      "Delivered a full mobile redesign for a retail client under a six-week agency engagement, from research through handoff.",
    impact: "App launched to roughly 50,000 existing users with no critical issues reported in the first month.",
    date: "2018-09-10",
    evidenceTag: "Case study",
    evidenceNote: "Kept as a portfolio case study, covers the full research-to-handoff arc under a hard deadline.",
    skillIds: ["skill-1", "skill-4"],
    status: "confirmed",
    strengthens: "The range-of-scope evidence behind your Base CV, full end-to-end delivery under a tight external deadline.",
  },
  {
    id: "tre-11",
    title: "Drafted the credibility-check heuristic used in this week's AI review",
    story:
      "Defined checks for when the underwriting assistant should flag a low-confidence case for human review, working through edge cases with the data science team until the rule held up.",
    impact: "Heuristic is already referenced in this week's model review notes.",
    date: "2026-07-28",
    evidenceTag: "Artifact",
    whySuggested:
      "Copilot noticed you and the data science team spent Tuesday's sync defining checks for when the underwriting assistant should flag low-confidence cases for human review.",
    evidenceHint: "Referenced in this week's model review notes.",
    skillIds: ["skill-5", "skill-6"],
    status: "candidate",
  },
  {
    id: "tre-12",
    title: "Ran a lightning research sprint on trust cues for the assistant beta",
    story:
      "Ran three quick research sessions this week on how beta users react to the assistant's confidence indicator, looking for where trust breaks down.",
    impact: "Findings not yet written up; worth capturing before detail fades.",
    date: "2026-07-30",
    evidenceTag: "Reference quote",
    whySuggested:
      "Copilot noticed three research sessions logged this week on how beta users react to the assistant's confidence indicator.",
    evidenceHint: "Session notes exist but findings aren't written up yet; worth capturing before detail fades.",
    skillIds: ["skill-3", "skill-6"],
    status: "candidate",
  },
];

// The single scripted example of a next action, marked done on an
// Interview-stage opportunity, seeding a new candidate into the review
// inbox. Wired from lib/store.tsx's SET_NEXT_ACTION_STATE case.
export const PANEL_PREP_TRIGGER_ACTION_ID = "action-3";
export const PANEL_PREP_CANDIDATE_ID = "tre-panel-prep";

export function buildPanelPrepCandidate(dateStamp: string): TrackRecordEntry {
  return {
    id: PANEL_PREP_CANDIDATE_ID,
    title: "Prepped talking points for the Meridian Labs design leadership panel",
    story:
      "Pulled together talking points on leading design decisions across the evaluation console, anchored in the explainability panel work and the discovery sprint that shaped the assistant's trust boundary.",
    impact: "Went into the Meridian Labs panel round with three concrete leadership examples ready to reference.",
    date: dateStamp,
    evidenceTag: "Artifact",
    whySuggested:
      "Copilot noticed you marked \"Prep answers for the Meridian Labs design leadership panel\" done, right as the Interview-stage panel round approaches.",
    evidenceHint: "Worth capturing while the panel prep specifics are still fresh.",
    skillIds: ["skill-9", "skill-10"],
    status: "candidate",
  };
}
