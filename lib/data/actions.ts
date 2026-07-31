import type { NextAction } from "@/lib/types";

// 6 next actions in mixed states: suggested, accepted, done, dismissed.
export const nextActions: NextAction[] = [
  {
    id: "action-1",
    opportunityId: "opp-1",
    verb: "Send your AI explainability case study to the referral contact",
    rationale: "Solace AI is a Dream, strong-fit match and the referral is still warm from three weeks ago.",
    effort: "20 min",
    dueHint: "This week",
    state: "accepted",
  },
  {
    id: "action-2",
    opportunityId: "opp-4",
    verb: "Follow up with the Arclight AI recruiter on application status",
    rationale: "No update in 12 days on a strong-fit, high-priority application is worth a light nudge.",
    effort: "10 min",
    dueHint: "Next 2 days",
    state: "suggested",
  },
  {
    id: "action-3",
    opportunityId: "opp-6",
    verb: "Prep answers for the Meridian Labs design leadership panel",
    rationale: "Panel round is scheduled and typically probes how you'd lead design decisions, not just make them.",
    effort: "45 min",
    dueHint: "Before Thursday",
    state: "accepted",
  },
  {
    id: "action-4",
    opportunityId: "opp-7",
    verb: "Send a thank-you note after the Brightpath Bank final loop",
    rationale: "A same-week note after a final loop keeps momentum while the panel deliberates.",
    effort: "10 min",
    dueHint: "Same day",
    state: "done",
  },
  {
    id: "action-5",
    opportunityId: "opp-8",
    verb: "Compare the Orbit Logistics offer against your target compensation range",
    rationale: "Offer deadline is approaching and the base is at the low end of what you told Copilot you're targeting.",
    effort: "30 min",
    dueHint: "Before the offer deadline",
    state: "suggested",
  },
  {
    id: "action-6",
    opportunityId: "opp-3",
    verb: "Research Northwind Robotics' recent product launches before applying",
    rationale: "Hardware-adjacent domain is new territory, worth a quick scan before committing time to an application.",
    effort: "15 min",
    dueHint: "No rush",
    state: "dismissed",
  },
];
