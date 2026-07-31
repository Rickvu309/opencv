import type { Nudge, WeeklyReviewScript } from "@/lib/types";

// 3 nudges: stale opportunity, capture prompt, high-potential flag.
export const nudges: Nudge[] = [
  {
    id: "nudge-1",
    trigger: "stale-opportunity",
    message: "Northwind Robotics has had no activity in 11 weeks. Decide whether it's still worth pursuing.",
    suggestedAction: "Move to Applied, or archive it to keep your board focused.",
    relatedOpportunityId: "opp-3",
    state: "active",
  },
  {
    id: "nudge-2",
    trigger: "capture-prompt",
    message: "This week's AI review sync and the trust-cue research sprint both look worth capturing in Track Record before the details fade.",
    suggestedAction: "Review the 2 drafted candidates in Track Record.",
    state: "active",
  },
  {
    id: "nudge-3",
    trigger: "high-potential",
    message: "Solace AI is a Dream opportunity with a strong fit and a warm referral. It's been 4 weeks since you saved it.",
    suggestedAction: "Send the accepted next action today.",
    relatedOpportunityId: "opp-1",
    state: "active",
  },
];

// 1 weekly review script.
export const weeklyReviewScript: WeeklyReviewScript = {
  whatHappened: [
    "Meridian Labs moved to the panel round after two positive interview rounds.",
    "Brightpath Bank's final loop wrapped, decision still pending.",
    "Orbit Logistics extended an offer with a deadline approaching.",
    "Two track record candidates were drafted from this week's AI review sync and a research sprint.",
  ],
  whatChanged: [
    "Your active pipeline now has 3 strong-fit opportunities in motion at once, up from 1 last week.",
    "The Orbit Logistics offer puts a real deadline on your target-compensation decision.",
  ],
  suggestedFocus: [
    {
      id: "review-focus-1",
      text: "Prioritize Meridian Labs panel prep, it's your strongest AI-direction match with the nearest deadline.",
      state: "suggested",
    },
    {
      id: "review-focus-2",
      text: "Decide on Orbit Logistics before the offer window closes, even if the decision is to negotiate or decline.",
      state: "suggested",
    },
    {
      id: "review-focus-3",
      text: "Confirm or dismiss the 2 drafted Track Record candidates while the details are still fresh.",
      state: "suggested",
    },
  ],
};
