import type { RewindWeekStory } from "@/lib/types";

// Rewind (RDS-980): the connected weekly review as a full route. This file
// holds the current week's seed content: the top-band story first, with
// candidates, carry-forwards, and the past-weeks archive added alongside the
// review and closing zones later in this same file.

// ---------------------------------------------------------------------------
// The week story: a one-line shape of the week plus 3 compact theme
// clusters. Counts are narrative, not a literal re-render of
// activityMoments or emailEvidence, the same synthesis weeklyReviewScript's
// old whatMoved list already did, kept consistent with the real seed facts
// each cluster draws from.
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
