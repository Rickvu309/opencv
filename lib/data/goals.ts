import type { DirectionGapAnalysis, Goal, PathScenario } from "@/lib/types";

// 4 goals, one with a gap analysis (goal-1, against the target direction).
// Split across horizon (near term, long term) for the Goals page's two zones.
// Also seeds pathScenarios and directionGapAnalysis: the path scenarios feed
// both /goals' scenario cards and the Path Planner's recommended/alternative
// zones (/planner, /roadmap).
// Surface: /goals, /planner, /roadmap.
export const goals: Goal[] = [
  {
    id: "goal-1",
    title: "Land a senior or staff AI product design role",
    why: "Three years designing the explainability layer at Fintra confirmed this is the work Mai wants more of, at a company where AI product design is the core job, not a side project.",
    targetDate: "2026-10-01",
    horizon: "near term",
    status: "on track",
    progressNotes: [
      {
        id: "goal-1-note-1",
        note: "Three strong-fit opportunities active: Solace AI (Dream, saved), Arclight AI (applied), Meridian Labs (interview, final panel scheduled).",
        createdAt: "2026-07-28",
      },
    ],
    opportunityIds: ["opp-1", "opp-4", "opp-6"],
    learningItemIds: ["li-1", "li-2", "li-6"],
  },
  {
    id: "goal-2",
    title: "Publish a portfolio case study on AI explainability",
    why: "Every AI-forward opportunity Mai is pursuing asks for concrete proof of this exact work, and it currently only exists as internal Fintra documents.",
    targetDate: "2026-08-15",
    horizon: "near term",
    status: "needs attention",
    progressNotes: [
      {
        id: "goal-2-note-1",
        note: "Outline drafted from the Fintra explainability panel and the Meridian Labs tailored CV.",
        createdAt: "2026-07-05",
      },
      {
        id: "goal-2-note-2",
        note: "Full write-up not started yet, three weeks out from the target date.",
        createdAt: "2026-07-28",
      },
    ],
    opportunityIds: ["opp-1", "opp-6"],
    learningItemIds: ["li-4"],
  },
  {
    id: "goal-3",
    title: "Grow into people leadership",
    why: "Mai has mentored two designers informally but has never had direct reports. Halo Bank's manager role would make this official.",
    targetDate: "2026-12-01",
    horizon: "long term",
    status: "needs attention",
    progressNotes: [
      {
        id: "goal-3-note-1",
        note: "Halo Bank final interview loop complete, awaiting a decision.",
        createdAt: "2026-07-20",
      },
      {
        id: "goal-3-note-2",
        note: "No formal management training started yet.",
        createdAt: "2026-07-28",
      },
    ],
    opportunityIds: ["opp-7"],
    learningItemIds: ["li-3"],
  },
  {
    id: "goal-4",
    title: "Build a public design writing habit",
    why: "A visible body of writing would support both the AI product design move and any future leadership search, and Mai has wanted this for over a year without traction.",
    targetDate: "2026-09-30",
    horizon: "long term",
    status: "parked",
    progressNotes: [
      {
        id: "goal-4-note-1",
        note: "One meetup talk given in 2022, nothing published since.",
        createdAt: "2026-06-01",
      },
      {
        id: "goal-4-note-2",
        note: "Paused this quarter to focus on the Meridian Labs and Halo Bank interview loops. Picking the writing cadence back up once both decisions land.",
        createdAt: "2026-07-28",
      },
    ],
    learningItemIds: ["li-4", "li-5"],
  },
];

// 3 path scenarios for Zone 2, "Where this can go". Framing aids only, never
// commitments: the user can set one as the target direction from here.
export const pathScenarios: PathScenario[] = [
  {
    id: "scenario-1",
    title: "AI product designer at a product company",
    description:
      "Join an AI-native product company as a senior or staff individual-contributor designer, owning explainability and trust surfaces the way Mai already does at Fintra.",
    optimizesFor: "Depth in AI-specific design craft, working close to model behavior every day.",
    tradeoff: "Slower path to a formal leadership title, since the scope stays individual-contributor for now.",
    fitWithStrengths: "Strong",
    nextSixMonths: [
      "Close out the Solace AI and Meridian Labs loops already in motion.",
      "Publish the AI explainability case study to make the specialization visible externally.",
      "Turn down or deprioritize roles without a genuine AI product surface, even at higher compensation.",
    ],
    isClosestToCurrentTrajectory: true,
    closestReason:
      "Two of three active strong-fit opportunities, Solace AI and Meridian Labs, already sit squarely in this lane.",
    confidence: "High",
    whySummary:
      "Three of your four Strong-fit opportunities right now, Solace AI, Arclight AI, and Meridian Labs, already sit in this exact lane. It draws directly on your strongest named strength, translating ambiguous AI model behavior into trustworthy user flows, proven by the Fintra explainability panel that cut support tickets 22 percent.",
    whyThisReading:
      "Built from three signals: the strength evidence above, the trust-boundary discovery sprint documented in your track record that already anchors both the Meridian Labs and Solace AI positioning, and the fact that pursuing this path costs nothing you are not already doing, every active AI-forward loop stays exactly where it is.",
    readinessToday: "Two loops already in a live decision window: Meridian Labs' panel round and Solace AI's warm referral.",
    timeToViable: "0 to 3 months, largely a matter of which live loop closes first.",
    evidenceStrength: "Strong",
  },
  {
    id: "scenario-2",
    title: "Design lead building an AI practice",
    description:
      "Take a first design-management role at a company building AI-forward products, and use it to define how design partners with data science company-wide.",
    optimizesFor: "Leadership scope now, with AI exposure as part of the mandate rather than the whole job.",
    tradeoff: "Less hands-on AI craft time day to day, since more hours go to managing and hiring.",
    fitWithStrengths: "Medium",
    nextSixMonths: [
      "Decide on the Halo Bank offer once it lands, weighing its lending-only scope against a more AI-forward manager role.",
      "Start the engineering-manager shadow week already lined up to test the leadership transition.",
      "Look for a second design-lead opening at an AI-forward company as a hedge.",
    ],
    confidence: "Medium",
    whySummary:
      "Halo Bank's people-management loop is the furthest along of any leadership-track opportunity, and your mentoring track record, two designers promoted within a year, is real evidence. It is also your only proof point for management specifically, so this reading leans on one strong data point rather than a pattern.",
    whyThisReading:
      "Weighed the completed Halo Bank final loop and the mentoring outcomes against the honest fact that no track record entry shows you with a direct report, the exact gap the leadership branch of your target direction still needs closed.",
    readinessToday: "One completed leadership loop, Halo Bank, awaiting a decision, no confirmed management experience yet.",
    timeToViable: "3 to 6 months, pending the Halo Bank decision and whatever ramp-up follows.",
    evidenceStrength: "Medium",
  },
  {
    id: "scenario-3",
    title: "Independent AI design consultant",
    description:
      "Leave full-time work to consult on AI explainability and trust design for a handful of clients at once, trading stability for range and control.",
    optimizesFor: "Variety of problems and full control over which AI companies she works with.",
    tradeoff: "No steady paycheck or benefits, and the first 6 to 12 months go to building a client pipeline from scratch.",
    fitWithStrengths: "Weak",
    nextSixMonths: [
      "Would need at least two committed clients lined up before giving notice anywhere.",
      "Has not yet tested pricing, contracts, or scope-setting as an independent consultant.",
      "No immediate next step planned, this stays a longer-range option.",
    ],
    confidence: "Low",
    whySummary:
      "No active opportunity or track record entry tests independent consulting work directly, so this stays the most speculative of the three paths. It reflects stated interest rather than anything demonstrated yet.",
    whyThisReading:
      "Nothing in your pipeline or track record has tested pricing, contracts, or scope-setting as an independent consultant, so this reading leans entirely on stated interest, not proof.",
    readinessToday: "Not started, no clients, pricing, or contracts tested yet.",
    timeToViable: "6 to 12 months at minimum before it could replace steady income.",
    evidenceStrength: "Weak",
  },
];

// Zone 3 gap analysis against the target direction. Missing items link to
// their skill and, where one is already suggested, the specific learning
// item, so ticket 13's full learning plan on /skills can plug straight into
// these connections.
export const directionGapAnalysis: DirectionGapAnalysis = {
  aligned: [
    {
      id: "gap-aligned-1",
      label: "Translating ambiguous AI model behavior into trustworthy user flows",
      evidenceNote:
        "Directly shown by the AI underwriting explainability panel shipped at Fintra, which cut related support tickets by 22 percent.",
      trackRecordEntryId: "tre-1",
    },
    {
      id: "gap-aligned-2",
      label: "Running discovery research end to end",
      evidenceNote:
        "Evidenced by building Fintra's first structured usability testing program, from screener design through synthesis.",
      trackRecordEntryId: "tre-4",
    },
    {
      id: "gap-aligned-3",
      label: "Building design systems that scale across teams",
      evidenceNote:
        "Backed by the three-squad design system rollout at Loop Commerce that cut new-screen build time by about 33 percent.",
      trackRecordEntryId: "tre-3",
    },
  ],
  missing: [
    {
      id: "gap-missing-1",
      label: "AI and ML literacy",
      note: "Level 2 of a targeted 4. Still building enough working understanding of model behavior to design for it without leaning on data science for every judgment call.",
      skillId: "skill-5",
      learningItemId: "li-1",
    },
    {
      id: "gap-missing-2",
      label: "AI interaction and prompt design",
      note: "Level 2 of a targeted 4. Has not yet designed a conversational or prompt-driven interface end to end.",
      skillId: "skill-6",
      learningItemId: "li-2",
    },
    {
      id: "gap-missing-3",
      label: "People management",
      note: "Level 1 of a targeted 4. Has mentored designers informally but never held a direct report.",
      skillId: "skill-8",
      learningItemId: "li-3",
    },
  ],
  uncertain: [
    {
      id: "gap-uncertain-1",
      label: "How much AI and ML depth staff-level roles actually expect",
      note: "Job postings describe the bar inconsistently, somewhere between working fluency and near-technical depth, and it isn't clear yet which one Mai's target companies mean.",
    },
    {
      id: "gap-uncertain-2",
      label: "Whether a design-lead title requires management experience she doesn't have yet",
      note: "Halo Bank is treating this as a first-time manager role, but it's unclear whether AI-forward companies expect prior direct reports before making the same call.",
    },
  ],
  pathIntoLearningNote: "Skills & Learning has 3 suggested learning items already lined up against these gaps.",
};
