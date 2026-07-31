import type { RoadmapMilestone, RoadmapResource } from "@/lib/types";

// The Roadmap (RDS-983): the Path Planner's working path turned into a
// guided, staged journey, 3 milestones per scenario, 2 to 3 resources each.
// Milestone ids follow roadmap-<scenarioId>-m<order>; resource ids follow
// res-<milestoneId>-<n>. Kept separate from lib/data/planner.ts because a
// milestone reads across skills, plan items, and track record entries
// rather than owning a flat list the way the growth plan stages do.

// ---------------------------------------------------------------------------
// Orientation: the 2 strongest skills relevant to each scenario, shown in
// the roadmap's "Now" pole. Both already sit above the scenario's own gap
// skills, so the orientation band opens on strength, not the gap list.
// ---------------------------------------------------------------------------

export const roadmapOrientationSkillIds: Record<string, [string, string]> = {
  "scenario-1": ["skill-1", "skill-3"],
  "scenario-2": ["skill-10", "skill-9"],
  "scenario-3": ["skill-1", "skill-9"],
};

// The 2 named opportunities each path most directly strengthens, shown in
// the roadmap's Connections zone. scenario-1's pair matches milestone 1's
// own unlock line, so the two never disagree about which opportunities are
// meant.
export const roadmapStrengthensOpportunityIds: Record<string, [string, string]> = {
  "scenario-1": ["opp-1", "opp-6"],
  "scenario-2": ["opp-7", "opp-3"],
  "scenario-3": ["opp-1", "opp-4"],
};

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export const roadmapMilestones: RoadmapMilestone[] = [
  // --- scenario-1: AI product designer at a product company --------------
  {
    id: "roadmap-scenario-1-m1",
    scenarioId: "scenario-1",
    order: 1,
    name: "Ship one AI feature story",
    outcomeStatement:
      "You've applied a working prompt design skill to a real feature, and the shipped result has a case study outline behind it.",
    unlockLine: "Unlocks: stronger fit for Solace AI and Meridian Labs, your two live AI-forward loops.",
    skillMoves: [{ id: "sm-1-1-1", skillId: "skill-6", fromLevel: 2, toLevel: 3, sequence: "now" }],
    proofItems: [
      {
        id: "proof-milestone-1-1-0",
        label: "Explainability panel case study evidence already shipped",
        sequence: "now",
        linkedPlanItemId: "plan-1-now-3",
      },
      { id: "proof-milestone-1-1-1", label: "Ship a small AI-assisted feature as a side project", sequence: "now", linkedPlanItemId: "plan-1-mid-1" },
      {
        id: "proof-milestone-1-1-2",
        label: "Draft the case study outline from the shipped feature",
        sequence: "after Ship a small AI-assisted feature as a side project",
        proposedActionLabel: "Add the outline to Track Record",
        proposedActionHref: "/track-record",
      },
    ],
  },
  {
    id: "roadmap-scenario-1-m2",
    scenarioId: "scenario-1",
    order: 2,
    name: "Prove it in public",
    outcomeStatement:
      "The AI explainability case study is public, and one talk backs it up, so a panel finds real proof instead of a claim.",
    unlockLine: "Unlocks: a public reference every AI-forward interview loop has been asking for.",
    skillMoves: [
      { id: "sm-1-2-1", skillId: "skill-12", fromLevel: 2, toLevel: 3, sequence: "after Ship one AI feature story" },
    ],
    proofItems: [
      {
        id: "proof-milestone-1-2-1",
        label: "Publish the AI explainability case study externally",
        sequence: "after Ship one AI feature story",
        proposedActionLabel: "Add the public write-up to Track Record once published",
        proposedActionHref: "/track-record",
      },
      {
        id: "proof-milestone-1-2-2",
        label: "Give one internal talk this quarter",
        sequence: "after Publish the AI explainability case study externally",
        linkedPlanItemId: "plan-1-late-2",
      },
    ],
  },
  {
    id: "roadmap-scenario-1-m3",
    scenarioId: "scenario-1",
    order: 3,
    name: "Operate at product altitude",
    outcomeStatement:
      "You can back a staff-level pitch with metrics fluency and a documented AI review you led, not just design craft.",
    unlockLine: "Unlocks: staff-level range on Solace AI, Meridian Labs, and any future AI-forward staff role.",
    skillMoves: [
      { id: "sm-1-3-1", skillId: "skill-7", fromLevel: 3, toLevel: 4, sequence: "after Prove it in public" },
    ],
    proofItems: [
      {
        id: "proof-milestone-1-3-1",
        label: "Lead an AI product review with data science",
        sequence: "after Prove it in public",
        trackRecordEntryId: "tre-11",
      },
      {
        id: "proof-milestone-1-3-2",
        label: "Land a second AI-forward case study or talk",
        sequence: "after Lead an AI product review with data science",
        linkedPlanItemId: "plan-1-late-3",
      },
    ],
  },

  // --- scenario-2: Design lead building an AI practice --------------------
  {
    id: "roadmap-scenario-2-m1",
    scenarioId: "scenario-2",
    order: 1,
    name: "Land the first direct report",
    outcomeStatement: "You're managing at least one direct report with a working operating rhythm, not just mentoring informally.",
    unlockLine: "Unlocks: readiness for Halo Bank's people-management ask.",
    skillMoves: [{ id: "sm-2-1-1", skillId: "skill-8", fromLevel: 1, toLevel: 2, sequence: "now" }],
    proofItems: [
      {
        id: "proof-milestone-2-1-0",
        label: "Mentoring track record already proves leadership instinct",
        sequence: "now",
        linkedPlanItemId: "plan-2-now-2",
      },
      { id: "proof-milestone-2-1-1", label: "Shadow an engineering manager for a sprint", sequence: "now", linkedPlanItemId: "plan-2-mid-1" },
      {
        id: "proof-milestone-2-1-2",
        label: "Capture your first 1:1 rhythm once the Halo Bank offer lands",
        sequence: "now",
        proposedActionLabel: "Add the 1:1 rhythm to Track Record",
        proposedActionHref: "/track-record",
      },
    ],
  },
  {
    id: "roadmap-scenario-2-m2",
    scenarioId: "scenario-2",
    order: 2,
    name: "Build the AI practice playbook",
    outcomeStatement: "How design partners with data science is written down as a reusable framework, not something you only do informally.",
    unlockLine: "Unlocks: a second design-lead opening at an AI-forward company reads as credible, not aspirational.",
    skillMoves: [
      { id: "sm-2-2-1", skillId: "skill-9", fromLevel: 3, toLevel: 4, sequence: "after Land the first direct report" },
    ],
    proofItems: [
      {
        id: "proof-milestone-2-2-1",
        label: "Define how design partners with data science company-wide",
        sequence: "after Land the first direct report",
        linkedPlanItemId: "plan-2-late-1",
      },
    ],
  },
  {
    id: "roadmap-scenario-2-m3",
    scenarioId: "scenario-2",
    order: 3,
    name: "Lead at altitude",
    outcomeStatement: "The practice you built is portfolio evidence, and a second AI-forward leadership loop is realistically in reach.",
    unlockLine: "Unlocks: a credible design-lead pitch at any AI-forward company, not just Halo Bank.",
    skillMoves: [
      { id: "sm-2-3-1", skillId: "skill-12", fromLevel: 2, toLevel: 3, sequence: "after Build the AI practice playbook" },
    ],
    proofItems: [
      {
        id: "proof-milestone-2-3-1",
        label: "Capture the AI practice framework as portfolio evidence",
        sequence: "after Build the AI practice playbook",
        linkedPlanItemId: "plan-2-late-2",
      },
      {
        id: "proof-milestone-2-3-2",
        label: "Land a second design-lead conversation at an AI-forward company",
        sequence: "after Build the AI practice playbook",
        proposedActionLabel: "Open Opportunities to log one",
        proposedActionHref: "/opportunities",
      },
    ],
  },

  // --- scenario-3: Independent AI design consultant -----------------------
  {
    id: "roadmap-scenario-3-m1",
    scenarioId: "scenario-3",
    order: 1,
    name: "Land the first paid pilot",
    outcomeStatement: "You've run one paid engagement and know your real rate and scope, not a guess.",
    unlockLine: "Unlocks: real pricing and scope data instead of a guess.",
    skillMoves: [{ id: "sm-3-1-1", skillId: "skill-9", fromLevel: 3, toLevel: 4, sequence: "now" }],
    proofItems: [
      { id: "proof-milestone-3-1-1", label: "Line up at least two committed clients before giving notice", sequence: "now", linkedPlanItemId: "plan-3-now-1" },
      {
        id: "proof-milestone-3-1-2",
        label: "Run one paid pilot engagement",
        sequence: "after Line up at least two committed clients before giving notice",
        linkedPlanItemId: "plan-3-mid-1",
      },
    ],
  },
  {
    id: "roadmap-scenario-3-m2",
    scenarioId: "scenario-3",
    order: 2,
    name: "Prove the pilot",
    outcomeStatement: "The pilot is documented as a case study a prospective client can actually read.",
    unlockLine: "Unlocks: a case study to show the next two prospective clients.",
    skillMoves: [
      { id: "sm-3-2-1", skillId: "skill-7", fromLevel: 3, toLevel: 4, sequence: "after Land the first paid pilot" },
    ],
    proofItems: [
      {
        id: "proof-milestone-3-2-1",
        label: "Document the pilot as your first consulting case study",
        sequence: "after Land the first paid pilot",
        linkedPlanItemId: "plan-3-mid-2",
      },
      {
        id: "proof-milestone-3-2-2",
        label: "Capture a client reference once the pilot closes",
        sequence: "after Land the first paid pilot",
        proposedActionLabel: "Add the reference to Track Record",
        proposedActionHref: "/track-record",
      },
    ],
  },
  {
    id: "roadmap-scenario-3-m3",
    scenarioId: "scenario-3",
    order: 3,
    name: "Build the client roster",
    outcomeStatement: "A repeatable roster of paying clients replaces the one-off pilot, with contract templates ready to reuse.",
    unlockLine: "Unlocks: enough steady client revenue to responsibly leave full-time work.",
    skillMoves: [
      { id: "sm-3-3-1", skillId: "skill-12", fromLevel: 2, toLevel: 3, sequence: "after Prove the pilot" },
    ],
    proofItems: [
      { id: "proof-milestone-3-3-1", label: "Convert pilot relationships into an ongoing client roster", sequence: "after Prove the pilot", linkedPlanItemId: "plan-3-late-1" },
      { id: "proof-milestone-3-3-2", label: "Formalize contract and scope templates", sequence: "after Prove the pilot", linkedPlanItemId: "plan-3-late-2" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Resources: 2 to 3 fictional, believable resources per milestone. No real
// brand names. planStage matches the milestone's rough position in the
// growth plan (M1 now, M2 months 1 to 3, M3 months 4 to 6) so "Add to plan"
// lands the new PlanItem in the stage that already reads as its home.
// ---------------------------------------------------------------------------

export const roadmapResources: RoadmapResource[] = [
  // --- scenario-1, milestone 1 ---------------------------------------------
  {
    id: "res-roadmap-scenario-1-m1-1",
    milestoneId: "roadmap-scenario-1-m1",
    scenarioId: "scenario-1",
    title: "Prompt Systems for Product Teams",
    type: "course",
    effort: "2 hours a week for 3 weeks",
    whyItMatters: "AI interaction and prompt design sits at Working against a targeted Expert, the gap this milestone closes first.",
    whyNow: "Sequenced first: the shipped side project in this milestone depends on this skill.",
    whatItUnlocks: "Unlocks the working prompt-design skill this milestone's case study is built on.",
    isCopilotPick: true,
    copilotPickReason: "Closes the single largest skill gap on your AI-forward path.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-6",
  },
  {
    id: "res-roadmap-scenario-1-m1-2",
    milestoneId: "roadmap-scenario-1-m1",
    scenarioId: "scenario-1",
    title: "Build Week: Ship an AI Feature",
    type: "project-brief",
    effort: "3 evenings over 3 weeks",
    whyItMatters: "Nothing in your track record yet shows a shipped AI feature outside Fintra's internal work.",
    whyNow: "Starts once Prompt Systems for Product Teams gives you the vocabulary to design the interaction, not just the surface.",
    whatItUnlocks: "Unlocks the shipped artifact this milestone's case study is written from.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-5",
    linkedGoalId: "goal-1",
  },
  {
    id: "res-roadmap-scenario-1-m1-3",
    milestoneId: "roadmap-scenario-1-m1",
    scenarioId: "scenario-1",
    title: "AI Product Design Guild",
    type: "community",
    effort: "1 hour a week, async",
    whyItMatters: "A second read on prompt and interaction decisions before they go into a public case study.",
    whyNow: "Low effort, useful from day one alongside the course.",
    whatItUnlocks: "Unlocks peer review before the case study in milestone 2 goes public.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-6",
  },

  // --- scenario-1, milestone 2 ---------------------------------------------
  {
    id: "res-roadmap-scenario-1-m2-1",
    milestoneId: "roadmap-scenario-1-m2",
    scenarioId: "scenario-1",
    title: "Case Study Clinic",
    type: "practice-routine",
    effort: "45 minutes, one sitting",
    whyItMatters: "Every AI-forward opportunity you're pursuing asks for exactly this proof, and it currently exists only as internal Fintra documents.",
    whyNow: "Sequenced right after the feature ships in milestone 1, while the details are still fresh.",
    whatItUnlocks: "Unlocks the public case study this milestone is named for.",
    isCopilotPick: true,
    copilotPickReason: "Directly targets the one proof gap every active AI-forward loop names.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-12",
  },
  {
    id: "res-roadmap-scenario-1-m2-2",
    milestoneId: "roadmap-scenario-1-m2",
    scenarioId: "scenario-1",
    title: "Explain the Model: a talk-writing workshop",
    type: "course",
    effort: "One weekend",
    whyItMatters: "Public speaking and thought leadership sits at Working, with only one talk on record since 2022.",
    whyNow: "Feeds directly into the internal talk this milestone's proof list already has queued.",
    whatItUnlocks: "Unlocks a second, stronger talk sample beyond the 2022 meetup.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-12",
    linkedGoalId: "goal-4",
  },
  {
    id: "res-roadmap-scenario-1-m2-3",
    milestoneId: "roadmap-scenario-1-m2",
    scenarioId: "scenario-1",
    title: "Portfolio Story Lab",
    type: "community",
    effort: "1 hour a week, async",
    whyItMatters: "A second set of eyes on how the case study reads to someone outside Fintra.",
    whyNow: "Runs in parallel with the talk-writing workshop.",
    whatItUnlocks: "Unlocks a portfolio piece that reads clearly to an outside panel, not just internal reviewers.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-12",
  },

  // --- scenario-1, milestone 3 ---------------------------------------------
  {
    id: "res-roadmap-scenario-1-m3-1",
    milestoneId: "roadmap-scenario-1-m3",
    scenarioId: "scenario-1",
    title: "Metrics Fluency for Design Leaders",
    type: "course",
    effort: "3 hours a week for 2 weeks",
    whyItMatters: "Data storytelling with metrics sits at Strong against a targeted Expert, the last named gap on this path.",
    whyNow: "Sequenced last: it backs the staff-level framing this milestone is about, after the story and the proof are already public.",
    whatItUnlocks: "Unlocks a metrics-backed pitch for any staff-level AI product design role.",
    isCopilotPick: true,
    copilotPickReason: "The last remaining named skill gap on your recommended path.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-7",
  },
  {
    id: "res-roadmap-scenario-1-m3-2",
    milestoneId: "roadmap-scenario-1-m3",
    scenarioId: "scenario-1",
    title: "Run Your First AI Review",
    type: "practice-routine",
    effort: "One 90-minute session",
    whyItMatters: "Leading a cross-functional AI review is the concrete leadership rep this milestone's outcome depends on.",
    whyNow: "Runs once the case study and talk from milestone 2 give you material worth reviewing.",
    whatItUnlocks: "Unlocks the review this milestone's proof list is waiting on.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-6",
  },
  {
    id: "res-roadmap-scenario-1-m3-3",
    milestoneId: "roadmap-scenario-1-m3",
    scenarioId: "scenario-1",
    title: "Staff Design Circle",
    type: "community",
    effort: "1 hour a week, async",
    whyItMatters: "Calibration on what staff altitude actually looks like, from designers already operating there.",
    whyNow: "Useful once there's real material, the case study and the review, to bring to the group.",
    whatItUnlocks: "Unlocks outside calibration before your next staff-level interview loop.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-7",
  },

  // --- scenario-2, milestone 1 ---------------------------------------------
  {
    id: "res-roadmap-scenario-2-m1-1",
    milestoneId: "roadmap-scenario-2-m1",
    scenarioId: "scenario-2",
    title: "Manager Foundations Intensive",
    type: "course",
    effort: "2 hours a week for 4 weeks",
    whyItMatters: "People management sits at Beginning against a targeted Expert, the main open question behind this path.",
    whyNow: "Sequenced first: the engineering-manager shadow week and Halo Bank's own ask both assume this baseline.",
    whatItUnlocks: "Unlocks a working operating rhythm for a first direct report.",
    isCopilotPick: true,
    copilotPickReason: "The single largest skill gap standing between you and Halo Bank's manager ask.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-8",
  },
  {
    id: "res-roadmap-scenario-2-m1-2",
    milestoneId: "roadmap-scenario-2-m1",
    scenarioId: "scenario-2",
    title: "New Manager Peer Circle",
    type: "community",
    effort: "1 hour every other week",
    whyItMatters: "Nothing in your track record yet shows you with a direct report, only informal mentoring.",
    whyNow: "Useful from day one alongside the intensive, low effort against a first-time manager's real questions.",
    whatItUnlocks: "Unlocks a peer sounding board for the first direct report this milestone is about.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-8",
  },

  // --- scenario-2, milestone 2 ---------------------------------------------
  {
    id: "res-roadmap-scenario-2-m2-1",
    milestoneId: "roadmap-scenario-2-m2",
    scenarioId: "scenario-2",
    title: "Cross-Functional AI Operating Model",
    type: "project-brief",
    effort: "4 evenings over 3 weeks",
    whyItMatters: "How design and data science share responsibility only exists informally at Fintra, nothing is written up.",
    whyNow: "Sequenced once the first direct report is in place, so the framework reflects real management experience.",
    whatItUnlocks: "Unlocks the documented practice this milestone's proof list is waiting on.",
    isCopilotPick: true,
    copilotPickReason: "Turns an informal Fintra habit into the one artifact this milestone is named for.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-9",
  },
  {
    id: "res-roadmap-scenario-2-m2-2",
    milestoneId: "roadmap-scenario-2-m2",
    scenarioId: "scenario-2",
    title: "Design & Data Science Partnership Clinic",
    type: "practice-routine",
    effort: "One 60-minute session",
    whyItMatters: "Stakeholder and exec communication sits at Strong against a targeted Expert, the remaining lever on this milestone.",
    whyNow: "Runs alongside drafting the operating model, a live rehearsal for the framework in progress.",
    whatItUnlocks: "Unlocks a rehearsed version of the pitch before it goes to a wider audience.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-9",
  },

  // --- scenario-2, milestone 3 ---------------------------------------------
  {
    id: "res-roadmap-scenario-2-m3-1",
    milestoneId: "roadmap-scenario-2-m3",
    scenarioId: "scenario-2",
    title: "Design Leadership Storytelling Workshop",
    type: "course",
    effort: "One weekend",
    whyItMatters: "Public speaking and thought leadership sits at Working, the last named gap on this path.",
    whyNow: "Sequenced last: it turns the operating model from milestone 2 into a pitch worth telling.",
    whatItUnlocks: "Unlocks a credible design-lead pitch beyond Halo Bank alone.",
    isCopilotPick: true,
    copilotPickReason: "The last remaining named skill gap on your leadership path.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-12",
    linkedGoalId: "goal-4",
  },
  {
    id: "res-roadmap-scenario-2-m3-2",
    milestoneId: "roadmap-scenario-2-m3",
    scenarioId: "scenario-2",
    title: "AI Practice Leaders Roundtable",
    type: "community",
    effort: "1 hour a month",
    whyItMatters: "Calibration on how other design leads have framed a design-and-data-science practice before pitching it externally.",
    whyNow: "Useful once there's a real framework, from milestone 2, to bring to the group.",
    whatItUnlocks: "Unlocks outside calibration before your next design-lead conversation.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-9",
  },

  // --- scenario-3, milestone 1 ---------------------------------------------
  {
    id: "res-roadmap-scenario-3-m1-1",
    milestoneId: "roadmap-scenario-3-m1",
    scenarioId: "scenario-3",
    title: "Consulting Rates and Contracts Primer",
    type: "course",
    effort: "One weekend",
    whyItMatters: "No engagement so far has tested pricing or contract structure, every one has been full-time employment.",
    whyNow: "Sequenced first: pricing and scope need to be set before the first pilot conversation, not during it.",
    whatItUnlocks: "Unlocks a real rate and scope to quote the first two committed clients.",
    isCopilotPick: true,
    copilotPickReason: "Closes the one gap that blocks every other step on this path.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-9",
  },
  {
    id: "res-roadmap-scenario-3-m1-2",
    milestoneId: "roadmap-scenario-3-m1",
    scenarioId: "scenario-3",
    title: "Independent Consultants Network",
    type: "community",
    effort: "1 hour a week, async",
    whyItMatters: "All track record evidence so far comes from employers, not a client who hired you directly.",
    whyNow: "Useful from day one, a place to sanity-check rates and scope before the first pilot.",
    whatItUnlocks: "Unlocks warm introductions toward the first two committed clients.",
    state: "suggested",
    planStage: "now",
    linkedSkillId: "skill-9",
  },

  // --- scenario-3, milestone 2 ---------------------------------------------
  {
    id: "res-roadmap-scenario-3-m2-1",
    milestoneId: "roadmap-scenario-3-m2",
    scenarioId: "scenario-3",
    title: "Client Impact Metrics Workshop",
    type: "course",
    effort: "2 hours a week for 2 weeks",
    whyItMatters: "Data storytelling with metrics sits at Strong against a targeted Expert, the lever that makes the pilot's results legible to a client.",
    whyNow: "Sequenced once the pilot itself is running, so there are real numbers to work from.",
    whatItUnlocks: "Unlocks a metrics-backed version of the pilot case study.",
    isCopilotPick: true,
    copilotPickReason: "Turns the pilot's raw results into proof a prospective client can actually evaluate.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-7",
  },
  {
    id: "res-roadmap-scenario-3-m2-2",
    milestoneId: "roadmap-scenario-3-m2",
    scenarioId: "scenario-3",
    title: "Consulting Case Study Sprint",
    type: "project-brief",
    effort: "3 evenings over 2 weeks",
    whyItMatters: "Every track record entry so far comes from employment, not a client who hired you directly.",
    whyNow: "Sequenced right after the pilot closes, while the details are still fresh.",
    whatItUnlocks: "Unlocks the documented case study this milestone is named for.",
    state: "suggested",
    planStage: "months-1-3",
    linkedSkillId: "skill-7",
  },

  // --- scenario-3, milestone 3 ---------------------------------------------
  {
    id: "res-roadmap-scenario-3-m3-1",
    milestoneId: "roadmap-scenario-3-m3",
    scenarioId: "scenario-3",
    title: "Referral Systems for Independent Consultants",
    type: "practice-routine",
    effort: "One 60-minute session",
    whyItMatters: "One pilot reads as luck. A repeatable roster needs a system, not another one-off engagement.",
    whyNow: "Sequenced once the pilot is proven, so referrals point to a real case study.",
    whatItUnlocks: "Unlocks a repeatable path from one pilot to an ongoing client roster.",
    isCopilotPick: true,
    copilotPickReason: "The most direct lever from one proven pilot to a repeatable client roster.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-12",
  },
  {
    id: "res-roadmap-scenario-3-m3-2",
    milestoneId: "roadmap-scenario-3-m3",
    scenarioId: "scenario-3",
    title: "AI Design Consultants Guild",
    type: "community",
    effort: "1 hour a week, async",
    whyItMatters: "Public speaking and thought leadership sits at Working, and visibility is the main lever left for referrals.",
    whyNow: "Runs alongside formalizing contract and scope templates, a live audience for both.",
    whatItUnlocks: "Unlocks warm referrals toward the ongoing client roster.",
    state: "suggested",
    planStage: "months-4-6",
    linkedSkillId: "skill-12",
  },
];
