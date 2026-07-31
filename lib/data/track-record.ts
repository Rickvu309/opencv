import type { TrackRecordEntry } from "@/lib/types";

// 10 confirmed entries plus 2 unconfirmed AI-drafted candidates.
export const trackRecordEntries: TrackRecordEntry[] = [
  {
    id: "tre-1",
    title: "Shipped the AI underwriting explainability panel",
    story:
      "Designed the panel that shows loan applicants why the AI underwriting assistant reached its decision, working with data science to translate model factors into plain language.",
    impact: "Reduced underwriting-decision support tickets by 22 percent in the first quarter after launch.",
    date: "2024-11-08",
    evidenceTag: "Shipped",
    skillIds: ["skill-5", "skill-1"],
    status: "confirmed",
  },
  {
    id: "tre-2",
    title: "Redesigned the loan-onboarding form flow",
    story:
      "Rebuilt the multi-step onboarding form after discovery research showed applicants dropping off at document upload.",
    impact: "Cut onboarding drop-off by 18 percent quarter over quarter.",
    date: "2023-09-14",
    evidenceTag: "Shipped",
    skillIds: ["skill-1", "skill-3"],
    status: "confirmed",
  },
  {
    id: "tre-3",
    title: "Rolled out a shared design system across three squads",
    story:
      "Led the migration of three separate component libraries into one shared system, including a contribution model for squad-level additions.",
    impact: "Cut new-screen build time by roughly a third across the squads that adopted it.",
    date: "2021-10-02",
    evidenceTag: "Led",
    skillIds: ["skill-2", "skill-10"],
    status: "confirmed",
  },
  {
    id: "tre-4",
    title: "Established the first structured usability testing program",
    story:
      "Set up recruiting, screener design, and a shared synthesis template so usability testing could run every sprint instead of ad hoc.",
    impact: "Usability sessions went from roughly one per quarter to weekly, with findings tracked against a shared backlog.",
    date: "2019-06-20",
    evidenceTag: "Established",
    skillIds: ["skill-3"],
    status: "confirmed",
  },
  {
    id: "tre-5",
    title: "Mentored two designers into mid-level roles",
    story:
      "Ran structured weekly one-on-ones and portfolio reviews with two junior designers over a year, focused on critique skills and case-study writing.",
    impact: "Both designers were promoted to mid-level within twelve months.",
    date: "2025-01-15",
    evidenceTag: "Mentored",
    skillIds: ["skill-8", "skill-10"],
    status: "confirmed",
  },
  {
    id: "tre-6",
    title: "Presented the design system rollout at a regional UX meetup",
    story:
      "Gave a talk on the design system migration and contribution model to roughly 80 attendees at a Ho Chi Minh City UX meetup.",
    impact: "Talk led to two cross-company design system working sessions afterward.",
    date: "2022-03-11",
    evidenceTag: "Presented",
    skillIds: ["skill-12", "skill-2"],
    status: "confirmed",
  },
  {
    id: "tre-7",
    title: "Redesigned seller-tools checkout",
    story:
      "Reworked the seller-facing checkout and payout flow after support ticket analysis showed confusion around payout timing.",
    impact: "Cut related support tickets by 25 percent within two months of launch.",
    date: "2022-06-30",
    evidenceTag: "Shipped",
    skillIds: ["skill-1", "skill-7"],
    status: "confirmed",
  },
  {
    id: "tre-8",
    title: "Built the first company-wide accessibility audit checklist",
    story:
      "Wrote and piloted an accessibility checklist covering contrast, focus order, and screen-reader labeling, then rolled it into the design review process.",
    impact: "Adopted as a required review step for all new screens across the product org.",
    date: "2024-05-02",
    evidenceTag: "Built",
    skillIds: ["skill-11"],
    status: "confirmed",
  },
  {
    id: "tre-9",
    title: "Led the discovery sprint for the AI assistant concept",
    story:
      "Ran a five-day discovery sprint with data science and compliance to scope what the AI underwriting assistant should and should not decide on its own.",
    impact: "Sprint output became the trust-boundary spec the assistant still ships against.",
    date: "2023-05-19",
    evidenceTag: "Led",
    skillIds: ["skill-5", "skill-6"],
    status: "confirmed",
  },
  {
    id: "tre-10",
    title: "Shipped an agency client mobile redesign",
    story:
      "Delivered a full mobile redesign for a retail client under a six-week agency engagement, from research through handoff.",
    impact: "App launched to roughly 50,000 existing users with no critical issues reported in the first month.",
    date: "2018-09-10",
    evidenceTag: "Shipped",
    skillIds: ["skill-1", "skill-4"],
    status: "confirmed",
  },
  {
    id: "tre-11",
    title: "Drafted the credibility-check heuristic used in this week's AI review",
    story:
      "Copilot noticed you and the data science team spent Tuesday's sync defining checks for when the underwriting assistant should flag low-confidence cases for human review.",
    impact: "Heuristic is already referenced in this week's model review notes.",
    date: "2026-07-28",
    evidenceTag: "Drafted",
    skillIds: ["skill-5", "skill-6"],
    status: "candidate",
  },
  {
    id: "tre-12",
    title: "Ran a lightning research sprint on trust cues for the assistant beta",
    story:
      "Copilot noticed three research sessions logged this week on how beta users react to the assistant's confidence indicator.",
    impact: "Findings not yet written up; worth capturing before detail fades.",
    date: "2026-07-30",
    evidenceTag: "Researched",
    skillIds: ["skill-3", "skill-6"],
    status: "candidate",
  },
];
