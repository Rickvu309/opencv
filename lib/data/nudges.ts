import type { Nudge, WeeklyReviewScript } from "@/lib/types";

// 6 nudges covering all four attention-queue families: opportunity (stale,
// high-potential, missing next step), capture, goal, and learning. Every
// action is a real deep link, never a dead end.
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
    why: "Two drafted candidates are waiting in your review inbox before the details fade.",
    actions: [{ label: "Review candidates", href: "/track-record" }],
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

// The one weekly review script: what moved, what Copilot noticed, one
// candidate worth capturing, and 3 toggleable focus suggestions.
export const weeklyReviewScript: WeeklyReviewScript = {
  whatMoved: [
    "Meridian Labs moved to the panel round after two positive interview rounds.",
    "Halo Bank's final loop wrapped, decision still pending.",
    "Orbit Logistics extended an offer with a deadline approaching.",
    "Cascade AI was saved as a new opportunity, still waiting on a first Copilot read.",
    "Sent the Halo Bank thank-you note right after the final loop wrapped.",
  ],
  connectedSourcesRecap:
    "From your connected sources: Copilot scanned 9 emails this week and linked 7 threads to opportunities you're tracking.",
  observations: [
    {
      id: "review-observation-1",
      text: "Two Strong-fit opportunities, Arclight AI and Meridian Labs, are both waiting on someone else's timeline right now.",
      why: "Arclight's review committee meets on a biweekly cadence and Meridian's panel decision is still pending, worth planning this week around both waits instead of just one.",
    },
    {
      id: "review-observation-2",
      text: "The Orbit Logistics offer sits at the low end of your stated target compensation.",
      why: "You told Copilot your salary floor during onboarding, and the base-pay concern flagged in Orbit's fit read lines up with it directly.",
    },
    {
      id: "review-observation-3",
      text: "Cascade AI has been sitting in Saved for 2 days with no next step queued.",
      why: "Every other active opportunity already has a suggested or accepted next action, this is the one exception right now.",
    },
  ],
  suggestedFocus: [
    {
      id: "review-focus-1",
      text: "Prioritize Meridian Labs panel prep, it's your strongest AI-direction match with the nearest deadline.",
      state: "suggested",
      actionLabel: "Open Meridian Labs",
      actionHref: "/opportunities/opp-6#actions",
    },
    {
      id: "review-focus-2",
      text: "Decide on Orbit Logistics before the offer window closes, even if the decision is to negotiate or decline.",
      state: "suggested",
      actionLabel: "Open Orbit Logistics",
      actionHref: "/opportunities/opp-8#actions",
    },
    {
      id: "review-focus-3",
      text: "Confirm or dismiss the 2 drafted Track Record candidates while the details are still fresh.",
      state: "suggested",
      actionLabel: "Review candidates",
      actionHref: "/track-record",
    },
  ],
};
