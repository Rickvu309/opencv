import type { PlanItem, PlannerGapAnalysis } from "@/lib/types";

// The Path Planner (RDS-982): a staged growth plan and gap analysis, kept
// separate per path scenario so switching the working path (Goals' "Set as
// target direction", reused here) swaps in a coherent roadmap instead of
// relabeling the same one. Ordering inside each scenario's stage array is
// meaningful: index 0 of the "now" stage is the pinned recommended next move
// (Serial Position), read by lib/planner-utils.ts.

// ---------------------------------------------------------------------------
// One line under the alternatives comparison: what would change the ranking.
// ---------------------------------------------------------------------------

export const whatWouldChangeRanking =
  "A Meridian Labs offer, or a second AI-forward Strong-fit opportunity, would lock in the recommended path. A Halo Bank acceptance paired with a stalled AI-forward pipeline would be the clearest signal to promote the design-lead path instead.";

// ---------------------------------------------------------------------------
// Growth plan: 3 stages per scenario, 2 to 4 items each.
// ---------------------------------------------------------------------------

export const planItems: PlanItem[] = [
  // --- scenario-1: AI product designer at a product company --------------
  {
    id: "plan-1-now-1",
    scenarioId: "scenario-1",
    stage: "now",
    type: "pursue",
    title: "Prioritize Meridian Labs panel prep",
    detail: "The panel round Thursday, August 6 is the nearest live decision point on your strongest AI-forward loop.",
    state: "suggested",
    linkedOpportunityId: "opp-6",
  },
  {
    id: "plan-1-now-2",
    scenarioId: "scenario-1",
    stage: "now",
    type: "learn",
    title: "Start the AI Product Design Fundamentals course",
    detail: "Moves AI and ML literacy from Working toward Strong, the single biggest lever on this path.",
    state: "suggested",
    linkedSkillId: "skill-5",
    linkedLearningItemId: "li-1",
  },
  {
    id: "plan-1-now-3",
    scenarioId: "scenario-1",
    stage: "now",
    type: "prove",
    title: "Explainability panel case study evidence already shipped",
    detail: "The Fintra explainability panel is documented, screenshots and ticket-volume impact included.",
    state: "accepted",
    alreadyDone: true,
    trackRecordEntryId: "tre-1",
  },
  {
    id: "plan-1-now-4",
    scenarioId: "scenario-1",
    stage: "now",
    type: "prove",
    title: "Trust-boundary spec already documented",
    detail: "The discovery sprint that shaped the assistant's trust boundary is still the reference doc data science cites today.",
    state: "accepted",
    alreadyDone: true,
    trackRecordEntryId: "tre-9",
  },
  {
    id: "plan-1-mid-1",
    scenarioId: "scenario-1",
    stage: "months-1-3",
    type: "build",
    title: "Ship a small AI-assisted feature as a side project",
    detail: "Backs the course with a shipped artifact for the AI explainability portfolio case study.",
    state: "suggested",
    linkedSkillId: "skill-5",
    linkedLearningItemId: "li-6",
  },
  {
    id: "plan-1-mid-2",
    scenarioId: "scenario-1",
    stage: "months-1-3",
    type: "prove",
    title: "Publish the AI explainability case study",
    detail: "Every AI-forward opportunity you're pursuing asks for exactly this proof, and it currently only exists as internal Fintra documents.",
    state: "suggested",
    linkedGoalId: "goal-2",
    linkedLearningItemId: "li-4",
  },
  {
    id: "plan-1-mid-3",
    scenarioId: "scenario-1",
    stage: "months-1-3",
    type: "learn",
    title: "Complete the prompting and AI interaction patterns workshop",
    detail: "Moves AI interaction and prompt design from Working to Strong, unblocking Arclight AI's suggestion-and-approval design ask.",
    state: "suggested",
    linkedSkillId: "skill-6",
    linkedLearningItemId: "li-2",
  },
  {
    id: "plan-1-late-1",
    scenarioId: "scenario-1",
    stage: "months-4-6",
    type: "pursue",
    title: "Turn down roles without a genuine AI product surface",
    detail: "Even at higher compensation, staying selective keeps the pipeline pointed at this path rather than diluting it.",
    state: "suggested",
  },
  {
    id: "plan-1-late-2",
    scenarioId: "scenario-1",
    stage: "months-4-6",
    type: "learn",
    title: "Give one internal talk this quarter",
    detail: "A lower-effort complement to the case study, and the first proof point for public speaking beyond the 2022 meetup talk.",
    state: "suggested",
    linkedSkillId: "skill-12",
    linkedLearningItemId: "li-5",
  },
  {
    id: "plan-1-late-3",
    scenarioId: "scenario-1",
    stage: "months-4-6",
    type: "prove",
    title: "Land a second AI-forward case study or talk",
    detail: "One shipped case study reads as a lucky break. A second one reads as a specialization staff-level panels can trust.",
    state: "suggested",
  },

  // --- scenario-2: Design lead building an AI practice --------------------
  {
    id: "plan-2-now-1",
    scenarioId: "scenario-2",
    stage: "now",
    type: "pursue",
    title: "Decide on the Halo Bank offer once it lands",
    detail: "Weigh its lending-only scope against holding out for a more AI-forward manager role.",
    state: "suggested",
    linkedOpportunityId: "opp-7",
  },
  {
    id: "plan-2-now-2",
    scenarioId: "scenario-2",
    stage: "now",
    type: "prove",
    title: "Mentoring track record already proves leadership instinct",
    detail: "Two designers mentored into mid-level roles within twelve months, both willing to give a direct reference.",
    state: "accepted",
    alreadyDone: true,
    trackRecordEntryId: "tre-5",
  },
  {
    id: "plan-2-now-3",
    scenarioId: "scenario-2",
    stage: "now",
    type: "prove",
    title: "Cross-squad design system leadership already documented",
    detail: "The three-squad design system rollout is the leadership evidence already anchoring the Product-lead CV.",
    state: "accepted",
    alreadyDone: true,
    trackRecordEntryId: "tre-3",
  },
  {
    id: "plan-2-mid-1",
    scenarioId: "scenario-2",
    stage: "months-1-3",
    type: "learn",
    title: "Shadow an engineering manager for a sprint",
    detail: "Moves People management from Beginning to Working, direct preparation for a first formal report.",
    state: "suggested",
    linkedSkillId: "skill-8",
    linkedLearningItemId: "li-3",
  },
  {
    id: "plan-2-mid-2",
    scenarioId: "scenario-2",
    stage: "months-1-3",
    type: "pursue",
    title: "Look for a second design-lead opening at an AI-forward company",
    detail: "A hedge in case the Halo Bank decision lands the wrong way or the scope proves too lending-only.",
    state: "suggested",
  },
  {
    id: "plan-2-late-1",
    scenarioId: "scenario-2",
    stage: "months-4-6",
    type: "build",
    title: "Define how design partners with data science company-wide",
    detail: "The concrete deliverable that turns informal AI-and-design collaboration into a documented practice.",
    state: "suggested",
  },
  {
    id: "plan-2-late-2",
    scenarioId: "scenario-2",
    stage: "months-4-6",
    type: "prove",
    title: "Capture the AI practice framework as portfolio evidence",
    detail: "Turns the informal collaboration model at Fintra into a reusable, citable artifact for future leadership loops.",
    state: "suggested",
  },

  // --- scenario-3: Independent AI design consultant -----------------------
  {
    id: "plan-3-now-1",
    scenarioId: "scenario-3",
    stage: "now",
    type: "pursue",
    title: "Line up at least two committed clients before giving notice",
    detail: "The stated minimum before this path could responsibly replace full-time income.",
    state: "suggested",
  },
  {
    id: "plan-3-now-2",
    scenarioId: "scenario-3",
    stage: "now",
    type: "learn",
    title: "Research consulting rates and contract norms for AI design work",
    detail: "Nothing in your track record has tested pricing or scope-setting as an independent consultant yet.",
    state: "suggested",
  },
  {
    id: "plan-3-mid-1",
    scenarioId: "scenario-3",
    stage: "months-1-3",
    type: "build",
    title: "Run one paid pilot engagement",
    detail: "Tests pricing, scope-setting, and client management on a single low-risk engagement before committing further.",
    state: "suggested",
  },
  {
    id: "plan-3-mid-2",
    scenarioId: "scenario-3",
    stage: "months-1-3",
    type: "prove",
    title: "Document the pilot as your first consulting case study",
    detail: "Every track record entry so far comes from employment, not a client who hired you directly.",
    state: "suggested",
  },
  {
    id: "plan-3-late-1",
    scenarioId: "scenario-3",
    stage: "months-4-6",
    type: "pursue",
    title: "Convert pilot relationships into an ongoing client roster",
    detail: "Moves from one proof-of-concept engagement to the client pipeline this path depends on.",
    state: "suggested",
  },
  {
    id: "plan-3-late-2",
    scenarioId: "scenario-3",
    stage: "months-4-6",
    type: "build",
    title: "Formalize contract and scope templates",
    detail: "Makes each new engagement repeatable instead of renegotiated from scratch every time.",
    state: "suggested",
  },
];

// ---------------------------------------------------------------------------
// Gap and proof analysis: for each scenario, the 4 existing gap skills
// re-ranked and timed, plus honest evidence gaps specific to that path.
// ---------------------------------------------------------------------------

export const plannerGapAnalyses: PlannerGapAnalysis[] = [
  {
    scenarioId: "scenario-1",
    skills: [
      { skillId: "skill-5", timing: "now" },
      { skillId: "skill-6", timing: "now" },
      { skillId: "skill-12", timing: "by month 6" },
      { skillId: "skill-8", timing: "by month 6" },
    ],
    proof: [
      {
        id: "proof-1-1",
        label: "No shipped AI feature case study published externally",
        note: "The explainability panel work exists internally at Fintra. The public write-up hasn't gone out yet, and every AI-forward interview loop asks for exactly this proof.",
        timing: "now",
        linkedLearningItemId: "li-4",
        proposedActionLabel: "Add a public write-up to Track Record once published",
        proposedActionHref: "/track-record",
      },
      {
        id: "proof-1-2",
        label: "No public speaking or conference sample beyond one 2022 talk",
        note: "Staff-level AI panels increasingly probe how you communicate model behavior to non-technical stakeholders, and one meetup talk from 2022 is the only proof point on record.",
        timing: "by month 6",
        linkedLearningItemId: "li-5",
        proposedActionLabel: "Capture a talk or session as evidence",
        proposedActionHref: "/track-record",
      },
    ],
  },
  {
    scenarioId: "scenario-2",
    skills: [
      { skillId: "skill-8", timing: "now" },
      { skillId: "skill-12", timing: "now" },
      { skillId: "skill-5", timing: "by month 6" },
      { skillId: "skill-6", timing: "by month 6" },
    ],
    proof: [
      {
        id: "proof-2-1",
        label: "No formal management reference yet",
        note: "Both designers you mentored would vouch for you informally, but no interview panel has heard from a direct report, because you've never had one.",
        timing: "now",
        proposedActionLabel: "Capture a mentoring reference as evidence",
        proposedActionHref: "/track-record",
      },
      {
        id: "proof-2-2",
        label: "No documented cross-functional AI practice framework",
        note: "You've shaped how design and data science share responsibility informally at Fintra, but nothing is written up as a reusable framework yet.",
        timing: "by month 6",
        proposedActionLabel: "Add the framework once drafted",
        proposedActionHref: "/track-record",
      },
    ],
  },
  {
    scenarioId: "scenario-3",
    skills: [
      { skillId: "skill-12", timing: "now" },
      { skillId: "skill-8", timing: "by month 6" },
      { skillId: "skill-5", timing: "by month 6" },
      { skillId: "skill-6", timing: "by month 6" },
    ],
    proof: [
      {
        id: "proof-3-1",
        label: "No tested pricing or contract structure",
        note: "Every engagement so far has been full-time employment. Nothing tests how you'd scope or price standalone consulting work.",
        timing: "now",
        proposedActionLabel: "Capture a pilot engagement once run",
        proposedActionHref: "/track-record",
      },
      {
        id: "proof-3-2",
        label: "No independent client reference yet",
        note: "All track record evidence so far comes from employers, not a client who hired you directly.",
        timing: "by month 6",
        proposedActionLabel: "Add a client reference to Track Record",
        proposedActionHref: "/track-record",
      },
    ],
  },
];
