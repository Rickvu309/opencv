import type { Nudge } from "@/lib/types";

// 6 nudges covering all four attention-queue families: opportunity (stale,
// high-potential, missing next step), capture, goal, and learning. Every
// action is a real deep link, never a dead end.
// Surface: /home attention queue (components/home/attention-queue.tsx).
export const nudges: Nudge[] = [
  {
    id: "nudge-1",
    trigger: "stale-opportunity",
    message: "Mekong Robotics has had no activity in 11 weeks.",
    why: "Medium fit and hardware-adjacent scope, worth a clear decision instead of sitting in Saved indefinitely.",
    actions: [{ label: "Decide: pursue or archive", href: "/opportunities/opp-3#actions" }],
    relatedOpportunityId: "opp-3",
    state: "active",
  },
  {
    id: "nudge-3",
    trigger: "high-potential",
    message: "Solace AI is a Dream, Strong-fit opportunity with a warm referral, still sitting in Saved.",
    why: "It's been 8 weeks since you saved it and the accepted outreach action hasn't gone out yet.",
    actions: [
      { label: "Open Actions tab", href: "/opportunities/opp-1#actions" },
      { label: "View opportunity", href: "/opportunities/opp-1" },
    ],
    relatedOpportunityId: "opp-1",
    state: "active",
  },
  {
    id: "nudge-missing-next-step-1",
    trigger: "missing-next-step",
    message: "Cascade AI has been sitting in Saved for 2 days with no next step queued yet.",
    why: "Every other active opportunity already has a suggested or accepted next action, this is the one exception right now.",
    actions: [{ label: "Open opportunity", href: "/opportunities/opp-10" }],
    relatedOpportunityId: "opp-10",
    state: "active",
  },
  {
    id: "nudge-2",
    trigger: "capture-prompt",
    message:
      "This week's AI review sync and the trust-cue research sprint both look worth capturing in Track Record.",
    why: "Two drafted candidates are waiting in review before the details fade, one of them already grouped into this week's Rewind.",
    actions: [{ label: "Review in Rewind", href: "/rewind" }],
    state: "active",
  },
  {
    id: "nudge-goal-reminder-1",
    trigger: "goal-reminder",
    message:
      "\"Publish a portfolio case study on AI explainability\" is due August 15, 15 days out, and the full write-up hasn't started.",
    why: "Every AI-forward opportunity you're pursuing asks for this exact proof, worth picking back up now.",
    actions: [{ label: "Open goal", href: "/goals" }],
    relatedGoalId: "goal-2",
    state: "active",
  },
  {
    id: "nudge-learning-1",
    trigger: "learning-nudge",
    message:
      "\"Ship a small AI-assisted feature as a side project\" has been in your learning plan for a while with no progress logged.",
    why: "It's the hands-on complement to the AI Product Design Fundamentals course, and backs your explainability case study goal directly.",
    actions: [{ label: "Open learning plan", href: "/skills" }],
    relatedLearningItemId: "li-6",
    state: "active",
  },
];
