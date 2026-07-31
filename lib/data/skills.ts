import type { LearningItem, Skill } from "@/lib/types";

// Shared 4-level scale for every skill: 1 Beginning, 2 Working, 3 Strong,
// 4 Expert. Used by the level meter and by learning items' expected-benefit
// lines ("Moves X from Working to Strong").
export const LEVEL_LABELS: Record<number, string> = {
  1: "Beginning",
  2: "Working",
  3: "Strong",
  4: "Expert",
};

// 12 skills, 4 flagged as gaps against the target direction (skill-5, skill-6,
// skill-8, skill-12; the ranked gap insights for these live in
// lib/data/insights.ts). isFocus is a separate, user-set priority marker.
export const skills: Skill[] = [
  {
    id: "skill-1",
    name: "Interaction design",
    category: "Design craft",
    level: 4,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Foundational craft behind every role in your target direction, not a differentiator on its own at this point.",
    trackRecordEntryIds: ["tre-1", "tre-2", "tre-7", "tre-10"],
    relatedOpportunityIds: ["opp-1", "opp-4", "opp-6"],
  },
  {
    id: "skill-2",
    name: "Design systems",
    category: "Design craft",
    level: 4,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Useful at any scale, but a smaller factor for the AI product design direction than for the leadership branch.",
    trackRecordEntryIds: ["tre-3", "tre-6"],
  },
  {
    id: "skill-3",
    name: "User research",
    category: "Research",
    level: 3,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Feeds directly into the discovery work every AI-forward role expects you to lead, not just execute.",
    trackRecordEntryIds: ["tre-2", "tre-4", "tre-12"],
    relatedOpportunityIds: ["opp-3", "opp-4"],
  },
  {
    id: "skill-4",
    name: "Prototyping",
    category: "Design craft",
    level: 3,
    targetLevel: 3,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Supports fast iteration on AI-interaction patterns you don't have off-the-shelf components for yet.",
    trackRecordEntryIds: ["tre-10"],
    relatedOpportunityIds: ["opp-9"],
  },
  {
    id: "skill-5",
    name: "AI and ML literacy",
    category: "AI fluency",
    level: 2,
    targetLevel: 4,
    isGap: true,
    isFocus: true,
    targetDirectionRelevance:
      "Central to the AI product design direction, the clearest gap between where you sit and where your target roles sit.",
    trackRecordEntryIds: ["tre-1", "tre-9", "tre-11"],
    learningItemIds: ["li-1", "li-6"],
    relatedOpportunityIds: ["opp-1", "opp-3", "opp-6"],
  },
  {
    id: "skill-6",
    name: "AI interaction and prompt design",
    category: "AI fluency",
    level: 2,
    targetLevel: 4,
    isGap: true,
    isFocus: true,
    targetDirectionRelevance:
      "Tests whether you can design the conversational and prompt-driven layer itself, not just the surface around a model's output.",
    trackRecordEntryIds: ["tre-9", "tre-11", "tre-12"],
    learningItemIds: ["li-2"],
    relatedOpportunityIds: ["opp-4"],
  },
  {
    id: "skill-7",
    name: "Data storytelling with metrics",
    category: "Research",
    level: 3,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Backs the credibility of any AI or leadership pitch with hard numbers, a secondary but real factor either way.",
    trackRecordEntryIds: ["tre-7"],
    relatedOpportunityIds: ["opp-3", "opp-8"],
  },
  {
    id: "skill-8",
    name: "People management",
    category: "Leadership",
    level: 1,
    targetLevel: 4,
    isGap: true,
    isFocus: false,
    targetDirectionRelevance: "The main open question behind the leadership branch of your target direction.",
    trackRecordEntryIds: ["tre-5"],
    learningItemIds: ["li-3"],
    relatedOpportunityIds: ["opp-6", "opp-7"],
  },
  {
    id: "skill-9",
    name: "Stakeholder and exec communication",
    category: "Leadership",
    level: 3,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Matters more as roles move toward design leadership, less load-bearing for a pure AI product design track.",
    trackRecordEntryIds: ["tre-9"],
    relatedOpportunityIds: ["opp-7"],
  },
  {
    id: "skill-10",
    name: "Design critique facilitation",
    category: "Leadership",
    level: 4,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance: "A leadership-adjacent strength that supports either branch of your target direction.",
    trackRecordEntryIds: ["tre-3", "tre-5"],
    relatedOpportunityIds: ["opp-3", "opp-7"],
  },
  {
    id: "skill-11",
    name: "Accessibility design",
    category: "Design craft",
    level: 3,
    targetLevel: 4,
    isGap: false,
    isFocus: false,
    targetDirectionRelevance:
      "Solid craft depth, but not a distinguishing factor for either branch of your current target direction.",
    trackRecordEntryIds: ["tre-8"],
  },
  {
    id: "skill-12",
    name: "Public speaking and thought leadership",
    category: "Leadership",
    level: 2,
    targetLevel: 4,
    isGap: true,
    isFocus: false,
    targetDirectionRelevance:
      "Supports visibility for both branches of your target direction, though no active opportunity currently names it as a requirement.",
    trackRecordEntryIds: ["tre-6"],
    learningItemIds: ["li-4", "li-5"],
  },
];

// 6 learning items linked to skills or goals, ordered within each skill
// group from highest to lowest expected benefit.
export const learningItems: LearningItem[] = [
  {
    id: "li-1",
    title: "AI Product Design Fundamentals course",
    type: "course",
    effort: "3 hours a week for 4 weeks",
    skillId: "skill-5",
    goalId: "goal-1",
    state: "suggested",
    expectedBenefit:
      "Moves AI and ML literacy from Working to Strong, the single biggest lever on your Solace AI and Meridian Labs applications.",
    startHereReason:
      "Builds the baseline AI and ML literacy every other AI-focused learning item and opportunity here assumes you already have.",
  },
  {
    id: "li-2",
    title: "Prompting and AI interaction patterns workshop",
    type: "course",
    effort: "One weekend workshop plus 2 follow-up exercises",
    skillId: "skill-6",
    state: "suggested",
    expectedBenefit:
      "Moves AI interaction and prompt design from Working to Strong, unblocks your case for Arclight AI's suggestion-and-approval design ask.",
  },
  {
    id: "li-3",
    title: "Shadow an engineering manager for a sprint",
    type: "project",
    effort: "Two-week shadow, roughly 2 hours a week",
    skillId: "skill-8",
    goalId: "goal-3",
    state: "suggested",
    expectedBenefit:
      "Moves People management from Beginning to Working, direct preparation for Brightpath Bank's people-management ask.",
  },
  {
    id: "li-4",
    title: "Write one public case study per quarter",
    type: "habit",
    effort: "4 hours a week until published",
    skillId: "skill-12",
    goalId: "goal-4",
    state: "planned",
    expectedBenefit:
      "Moves Public speaking and thought leadership from Working toward Strong, and produces the visible case study your AI-explainability story still needs published.",
  },
  {
    id: "li-5",
    title: "Give one internal talk this quarter",
    type: "habit",
    effort: "One afternoon of prep, one hour to deliver",
    skillId: "skill-12",
    goalId: "goal-4",
    state: "suggested",
    expectedBenefit:
      "Moves Public speaking and thought leadership from Working to Strong through one concrete rep, a lower-effort complement to the quarterly writing habit.",
  },
  {
    id: "li-6",
    title: "Ship a small AI-assisted feature as a side project",
    type: "project",
    effort: "A few evenings over 3 weeks",
    skillId: "skill-5",
    goalId: "goal-1",
    state: "planned",
    expectedBenefit:
      "Moves AI and ML literacy from Working toward Strong through hands-on practice, backing the course with a shipped artifact for your portfolio case study.",
  },
];
