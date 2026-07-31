import type { RewindArchivedWeek, RewindCandidate, RewindCarryForward, RewindWeekStory } from "@/lib/types";

// Rewind (RDS-980): the connected weekly review as a full route. This file
// holds the current week's seed content: the top-band story, the "worth
// keeping" candidates, the carry-forward closing zone, and the past-weeks
// archive.

// ---------------------------------------------------------------------------
// The week story: a one-line shape of the week plus 3 compact theme
// clusters. Counts are narrative, not a literal re-render of
// activityMoments or emailEvidence, the same kind of synthesis the seeded
// nudges already do, kept consistent with the real seed facts each cluster
// draws from.
// ---------------------------------------------------------------------------

export const rewindWeekStory: RewindWeekStory = {
  weekLabel: "Week of July 27 to 31, 2026",
  shapeOfWeek:
    "A week anchored by Meridian Labs panel prep, a Halo Bank decision closing in, and enough AI-trust research worth capturing before it fades.",
  clusters: [
    {
      id: "cluster-meridian",
      title: "Meridian Labs interview loop",
      productActivityCount: 2,
      connectedItemCount: 2,
      moments: [
        "Added a note ahead of Thursday's panel round, planning to lead with the explainability story.",
        "Reused the tailored Meridian Labs CV to prep talking points.",
        "Jordan Ellis added a new ask: a ten-minute case-study walkthrough instead of open Q&A.",
        "Rehearsed the case-study walkthrough twice in a prep call with Linh Vu.",
      ],
    },
    {
      id: "cluster-halo",
      title: "Halo Bank decision",
      productActivityCount: 2,
      connectedItemCount: 1,
      moments: [
        "Final loop wrapped; sent the thank-you note the same day.",
        "Weighed the lending-only scope against the people-leadership goal it would serve.",
        "Thao Bui asked for a short follow-up call this Friday to confirm start-date flexibility.",
      ],
    },
    {
      id: "cluster-ai-review",
      title: "AI review sync and trust-cue research",
      productActivityCount: 1,
      connectedItemCount: 3,
      moments: [
        "Landed the credibility-check heuristic for low-confidence underwriting cases with the data science team.",
        "Ran three quick research sessions on how beta users read the assistant's confidence indicator.",
        "Minh Chau called the confidence-indicator rework some of the clearest systems thinking he's seen on the assistant.",
        "Ravi Desai recapped the heuristic, already cited in this week's model review notes.",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// "Worth keeping": 3 evidence-backed candidates, one per theme cluster
// above, each with the strict Observed, Read, Proposed anatomy (Miller's
// Law: 3 candidates, never more per glance). Candidate 3 reuses tre-11, the
// existing drafted Track Record candidate from this same underlying event,
// rather than forking a second object for it: saving confirms that entry in
// place with the new achievement depth added. Candidates 1 and 2 are net
// new, saving creates a fresh TrackRecordEntry at targetEntryId.
// ---------------------------------------------------------------------------

export const rewindCandidates: RewindCandidate[] = [
  {
    id: "rewind-candidate-1",
    targetEntryId: "tre-rewind-1",
    date: "2026-07-31",
    evidenceTag: "Artifact",
    observed: {
      activityLine:
        "Jordan Ellis asked for a ten-minute case-study walkthrough instead of open Q&A, two days before Thursday's panel, and rehearsed it twice in a prep call with Linh Vu the same week.",
      evidenceIds: ["email-meridian-recruiter", "meeting-panel-prep"],
    },
    read: {
      interpretation:
        "Reworking panel prep around a late format change, calmly and with time to spare, reads as evaluation-under-pressure skill, not just interview prep.",
      tag: "Adaptability",
    },
    proposed: {
      title: "Reworked Meridian Labs panel prep around a late format change",
      impactLine: "Walked into Thursday's panel round with the case-study walkthrough tightened across 2 prep passes.",
      impactSignals: [
        { kind: "scope", label: "Live panel round, senior-level loop" },
        { kind: "metric", label: "2 prep passes before the deadline" },
      ],
      skillIds: ["skill-5", "skill-9"],
      pathRelevance:
        "Direct evidence for landing a senior or staff AI product design role, the strongest active loop in that lane.",
    },
    state: "pending",
  },
  {
    id: "rewind-candidate-2",
    targetEntryId: "tre-rewind-2",
    date: "2026-07-29",
    evidenceTag: "Reference quote",
    observed: {
      activityLine:
        "Thao Bui asked for a Friday call to confirm start-date flexibility as Halo Bank's decision neared, the same week Linh Vu pushed back on rushing into the design-lead title.",
      evidenceIds: ["email-brightpath-scheduling", "meeting-mentor-conversation"],
    },
    read: {
      interpretation:
        "Treating a live leadership offer as a real decision instead of an automatic yes shows the same judgment a staff-level panel would want to see.",
      tag: "Strategic judgment",
    },
    proposed: {
      title: "Weighed the Halo Bank leadership track against the AI-forward direction",
      impactLine: "Held the decision open through 1 mentor conversation and Halo Bank's Friday follow-up call, instead of defaulting to the title.",
      impactSignals: [
        { kind: "scope", label: "Senior leadership decision, three-person team" },
        { kind: "recognition", label: "Mentor pushback taken seriously, not dismissed" },
      ],
      skillIds: ["skill-8", "skill-9"],
      pathRelevance:
        "Direct evidence for growing into people leadership, the exact tension between IC depth and a first management role.",
    },
    state: "pending",
  },
  {
    id: "rewind-candidate-3",
    targetEntryId: "tre-11",
    date: "2026-07-28",
    evidenceTag: "Artifact",
    observed: {
      activityLine:
        "Defined checks for when the underwriting assistant should flag a low-confidence case for human review, working through edge cases with the data science team until the rule held up.",
      evidenceIds: ["email-trackrecord-heuristic"],
    },
    read: {
      interpretation:
        "A heuristic the data science team is already citing in this week's model review reads as production-proven judgment, not just a good idea.",
      tag: "AI craft",
    },
    proposed: {
      title: "Drafted the credibility-check heuristic used in this week's AI review",
      impactLine: "Heuristic is already referenced in this week's model review notes.",
      impactSignals: [
        { kind: "scope", label: "Adopted into this week's model review process" },
        { kind: "recognition", label: "Already cited by the data science team" },
      ],
      skillIds: ["skill-5", "skill-6"],
      pathRelevance:
        "Direct evidence for landing a senior or staff AI product design role, closing the AI and ML literacy gap with a shipped judgment call, not just coursework.",
    },
    state: "pending",
  },
];

// ---------------------------------------------------------------------------
// Carry-forward: 3 closing-zone proposals for next week, one per required
// shape (unfinished important work, a growth prompt tied to the planner's
// next move, one opportunity follow-up). Five-beat acceptable: accepting
// pins a Nudge into the Home attention queue and, for the one that names an
// opportunity, adds a next action to that opportunity's plan.
// ---------------------------------------------------------------------------

export const rewindCarryForwards: RewindCarryForward[] = [
  {
    id: "carry-forward-1",
    kind: "unfinished-work",
    message: "The AI explainability case study is still just an outline, three weeks out from the August 15 target.",
    why: "Every AI-forward loop you're running, Meridian Labs included, asks for exactly this proof, and it only exists as internal Fintra documents right now.",
    proposedAction: "Pins a reminder to your Home attention queue, linked to the goal.",
    actionLabel: "Open goal",
    actionHref: "/goals",
    state: "suggested",
  },
  {
    id: "carry-forward-2",
    kind: "growth-prompt",
    message: "The Path Planner's next recommended move, starting the AI Product Design Fundamentals course, hasn't started yet.",
    why: "It's the single biggest lever on your strongest active path, and this month's panel and offer decisions leave less excuse to keep deferring it.",
    proposedAction: "Pins a reminder to your Home attention queue and keeps it visible in the Path Planner.",
    actionLabel: "Open Path Planner",
    actionHref: "/planner",
    state: "suggested",
  },
  {
    id: "carry-forward-3",
    kind: "opportunity-follow-up",
    message: "Arclight AI's review committee meets again next week; still no update since the last biweekly cycle.",
    why: "The committee's cadence means silence past two cycles is worth a deliberate follow-up, not just more waiting.",
    proposedAction: "Pins a reminder to your Home attention queue and adds a follow-up next action to Arclight AI's plan.",
    actionLabel: "Open Arclight AI",
    actionHref: "/opportunities/opp-4#actions",
    relatedOpportunityId: "opp-4",
    plannedNextAction: {
      verb: "Follow up with Arclight AI's recruiter on the review committee's decision",
      rationale: "Two biweekly review cycles have passed without an update.",
      effort: "15 minutes",
      dueHint: "This week",
    },
    state: "suggested",
  },
];

// ---------------------------------------------------------------------------
// Past weeks: a compact archive of 3 seeded previous Rewinds, each opening
// to a read-only summary.
// ---------------------------------------------------------------------------

export const rewindArchive: RewindArchivedWeek[] = [
  {
    id: "archive-week-1",
    weekLabel: "Week of July 20 to 24, 2026",
    shapeOfWeek: "A waiting week: Halo Bank's committee deliberated, Meridian Labs' panel prep ramped up, and the Orbit Logistics offer conversation began.",
    achievementsKept: 2,
    followUpsQueued: 2,
    highlightTitles: [
      "Tailored the Meridian Labs CV ahead of the panel round",
      "Documented the Halo Bank final-loop debrief while it was fresh",
    ],
  },
  {
    id: "archive-week-2",
    weekLabel: "Week of July 13 to 17, 2026",
    shapeOfWeek: "Halo Bank's final loop wrapped and the thank-you note went out same-day, while the AI explainability case study outline finally got started.",
    achievementsKept: 1,
    followUpsQueued: 3,
    highlightTitles: ["Outlined the AI explainability case study from the Fintra panel work"],
  },
  {
    id: "archive-week-3",
    weekLabel: "Week of July 6 to 10, 2026",
    shapeOfWeek: "Vanta Growth Labs' credibility flag got caught early, and Cascade AI research began.",
    achievementsKept: 1,
    followUpsQueued: 2,
    highlightTitles: ["Caught Vanta Growth Labs' credibility flag before applying further"],
  },
];
