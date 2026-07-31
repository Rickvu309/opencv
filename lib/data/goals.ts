import type { Goal } from "@/lib/types";

// 4 goals, one with a gap analysis (goal-1, against the target direction).
export const goals: Goal[] = [
  {
    id: "goal-1",
    title: "Land a senior or staff AI product design role",
    why: "Two years designing the explainability layer at Fintra confirmed this is the work Mai wants more of, at a company where AI product design is the core job, not a side project.",
    targetDate: "2026-10-01",
    progressNote: "Three strong-fit opportunities active: Solace AI (Dream, saved), Arclight AI (applied), Meridian Labs (interview, final panel scheduled).",
    status: "on track",
    opportunityIds: ["opp-1", "opp-4", "opp-6"],
    learningItemIds: ["li-1", "li-2", "li-6"],
  },
  {
    id: "goal-2",
    title: "Publish a portfolio case study on AI explainability",
    why: "Every AI-forward opportunity Mai is pursuing asks for concrete proof of this exact work, and it currently only exists as internal Fintra documents.",
    targetDate: "2026-08-15",
    progressNote: "Outline drafted from the Fintra explainability panel and the Meridian Labs tailored CV. Full write-up not started.",
    status: "in progress",
    opportunityIds: ["opp-1", "opp-6"],
    learningItemIds: ["li-4"],
  },
  {
    id: "goal-3",
    title: "Grow into people leadership",
    why: "Mai has mentored two designers informally but has never had direct reports. Brightpath Bank's manager role would make this official.",
    targetDate: "2026-12-01",
    progressNote: "Brightpath Bank final interview loop complete, awaiting a decision. No formal management training started yet.",
    status: "not started",
    opportunityIds: ["opp-7"],
    learningItemIds: ["li-3"],
  },
  {
    id: "goal-4",
    title: "Build a public design writing habit",
    why: "A visible body of writing would support both the AI product design move and any future leadership search, and Mai has wanted this for over a year without traction.",
    targetDate: "2026-09-30",
    progressNote: "One meetup talk given in 2022, nothing published since. Behind on the quarterly cadence Mai set for herself.",
    status: "at risk",
    learningItemIds: ["li-4", "li-5"],
  },
];
