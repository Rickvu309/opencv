import type { OpportunityComparisonProfile } from "@/lib/types";

// One profile per opportunity for the /opportunities/compare decision
// workspace (RDS-985): the four soft-judgment dimensions the grid can't pull
// straight off existing fields (Growth potential, Timing, Risk and
// unknowns, Preparation effort), plus the tradeoff highlight and verdict
// reasons the comparison workspace's Copilot layer renders from. Every line
// here is written to agree with that opportunity's own AI Analysis fit
// insight (lib/data/insights.ts) and next action (lib/data/actions.ts),
// never a fresh claim invented for this surface.
// Surface: /opportunities/compare.
export const comparisonProfiles: OpportunityComparisonProfile[] = [
  // --- opp-1: Solace AI (Saved, Dream, Strong fit) --------------------------
  {
    opportunityId: "opp-1",
    growthPotential: { tone: "success", label: "Defines a design practice from scratch" },
    timing: { tone: "warning", label: "Saved · referral quiet 8 wks" },
    risk: { tone: "warning", label: "Team past 5 people unverified" },
    preparationEffort: { tone: "warning", label: "Send the case study first" },
    tradeoffHighlight: {
      strength: "is the closest match to your target direction, backed by a warm referral",
      caveat: "the referral has sat quiet for eight weeks with no next step queued",
    },
    verdictReasons: {
      bestForNow:
        "The referral is still warm, but nothing moves until you send the case study. Not the fastest path to a decision right now.",
      bestLongTerm:
        "Staff scope building a design practice from nothing is the clearest ceiling of any option here. It's the role the rest of your search gets measured against.",
      safest:
        "Every verifiable detail lines up: funding, leadership, and pay all check out. The only open question is team structure past five people.",
    },
  },

  // --- opp-2: Vanta Growth Labs (Saved, credibility flag, Unknown fit) ------
  {
    opportunityId: "opp-2",
    growthPotential: { tone: "muted", label: "Can't be judged yet" },
    timing: { tone: "danger", label: "Saved · credibility unresolved" },
    risk: { tone: "danger", label: "Credibility check failed" },
    preparationEffort: { tone: "warning", label: "Confirm a real contact first" },
    tradeoffHighlight: {
      strength: "pays well above market for the stated scope",
      caveat: "the credibility check failed outright, nothing here is verified yet",
    },
    verdictReasons: {
      bestForNow: "Nothing moves until a real contact clears the credibility flag. Not a live option right now.",
      bestLongTerm:
        "Fit can't be judged responsibly until the credibility check clears, so there's no honest upside to weigh yet.",
      safest:
        "All three checks that normally confirm a real opening came back empty here, the least safe option by a wide margin.",
    },
  },

  // --- opp-3: Mekong Robotics (Saved, Medium fit, stale) --------------------
  {
    opportunityId: "opp-3",
    growthPotential: { tone: "warning", label: "Off to the side of your direction" },
    timing: { tone: "danger", label: "Saved · posting stale 11 wks" },
    risk: { tone: "warning", label: "Posting may be stalled" },
    preparationEffort: { tone: "neutral", label: "Decide pursue or archive" },
    tradeoffHighlight: {
      strength: "offers real mentoring scope toward your leadership goal",
      caveat: "the posting has sat unfilled for eleven weeks with no update",
    },
    verdictReasons: {
      bestForNow: "Eleven weeks of silence means the next step is a decision, not an application. Low urgency either way.",
      bestLongTerm: "Real mentoring scope helps your leadership goal, but there's no AI-facing work here at all.",
      safest: "Company and funding check out cleanly, the only open question is whether the search is still active.",
    },
  },

  // --- opp-4: Arclight AI (Applied, Strong fit) -----------------------------
  {
    opportunityId: "opp-4",
    growthPotential: { tone: "success", label: "Direct trust-boundary ownership" },
    timing: { tone: "neutral", label: "Applied · awaiting review" },
    risk: { tone: "warning", label: "Small pod, thin leadership track" },
    preparationEffort: { tone: "success", label: "Just a follow-up nudge" },
    tradeoffHighlight: {
      strength: "mirrors the exact trust-boundary work you already ship at Fintra",
      caveat: "the pod is small, with less room to prove people leadership",
    },
    verdictReasons: {
      bestForNow:
        "Already applied, with a light follow-up as the only next step. Low effort, real momentum toward a Strong-fit role.",
      bestLongTerm:
        "Direct ownership of the same trust-boundary pattern you already ship at Fintra. Advances the AI side of your goal immediately.",
      safest:
        "A named hiring manager, a public engineering blog, and confirmed funding all check out cleanly. The smaller team is the only real offset.",
    },
  },

  // --- opp-5: Lotus Finance (Applied, Weak fit) -----------------------------
  {
    opportunityId: "opp-5",
    growthPotential: { tone: "danger", label: "Lateral move at best" },
    timing: { tone: "muted", label: "Applied · slow, low priority" },
    risk: { tone: "warning", label: "Recruiter-sourced, unconfirmed scope" },
    preparationEffort: { tone: "neutral", label: "Decide whether to withdraw" },
    tradeoffHighlight: {
      strength: "would bring fast income stability from a verifiable, currently-hiring company",
      caveat: "it runs counter to both your remote preference and your AI-direction goal",
    },
    verdictReasons: {
      bestForNow: "The only real step left is deciding whether to formally withdraw. Little urgency, mostly cleanup.",
      bestLongTerm: "Broad, shallow scope with no AI-facing work runs counter to your target direction on nearly every count.",
      safest: "Company and product both check out, though the recruiter-sourced path keeps confidence at Medium.",
    },
  },

  // --- opp-6: Meridian Labs (Interview, Strong fit) -------------------------
  {
    opportunityId: "opp-6",
    growthPotential: { tone: "success", label: "Closest match to target direction" },
    timing: { tone: "success", label: "Interview · panel Aug 6" },
    risk: { tone: "warning", label: "Panel still untested on leadership" },
    preparationEffort: { tone: "warning", label: "Panel prep, about 45 min" },
    tradeoffHighlight: {
      strength: "moves fastest, two rounds in with a panel already scheduled",
      caveat: "the panel still has to test leadership judgment you haven't fully proven yet",
    },
    verdictReasons: {
      bestForNow:
        "Two rounds in with a panel already on the calendar for August 6. The most active, fastest-moving option you're holding.",
      bestLongTerm: "The single closest match to your target direction, with two rounds of positive signal already banked.",
      safest:
        "A referral confirmed twice over by real interview rounds is about as verified as a listing gets. The panel is the one open test left.",
    },
  },

  // --- opp-7: Halo Bank (Interview, Medium fit) -----------------------------
  {
    opportunityId: "opp-7",
    growthPotential: { tone: "warning", label: "Strong leadership rep, off AI track" },
    timing: { tone: "neutral", label: "Interview · awaiting decision" },
    risk: { tone: "warning", label: "No decision timeline given" },
    preparationEffort: { tone: "success", label: "Nothing to prep, just wait" },
    tradeoffHighlight: {
      strength: "gives you real first-time management scope",
      caveat: "it pulls time away from the AI-facing work your primary goal is built around",
    },
    verdictReasons: {
      bestForNow: "The loop is finished, so the only step left is asking for a timeline. Nothing for you to prepare right now.",
      bestLongTerm:
        "First-time management scope is the clearest path to your leadership goal available today. It runs counter to your AI-product goal though.",
      safest: "A verified recruiter and a final loop that matched the stated team confirm this is exactly what it claimed to be.",
    },
  },

  // --- opp-8: Orbit Logistics (Offer, Strong fit) ---------------------------
  {
    opportunityId: "opp-8",
    growthPotential: { tone: "warning", label: "Solid craft, no AI-direction lift" },
    timing: { tone: "warning", label: "Offer · deadline approaching" },
    risk: { tone: "success", label: "Fully verified through the loop" },
    preparationEffort: { tone: "neutral", label: "Compare offer terms" },
    tradeoffHighlight: {
      strength: "is a confirmed offer with your preferred remote work style",
      caveat: "it pays at the low end of your target range and isn't AI-forward",
    },
    verdictReasons: {
      bestForNow:
        "A live offer with a deadline is the most time-sensitive decision on the table. Reviewing the terms is the whole next step.",
      bestLongTerm: "Solid craft and scope, but a step sideways from the AI-facing work your target direction is built around.",
      safest: "A full interview loop confirmed every detail from the original posting, about as verified as an offer gets.",
    },
  },

  // --- opp-9: Vela Studio (Closed, Weak fit) --------------------------------
  {
    opportunityId: "opp-9",
    growthPotential: { tone: "danger", label: "No continuity toward your direction" },
    timing: { tone: "muted", label: "Closed · withdrawn" },
    risk: { tone: "muted", label: "Closed, no live risk" },
    preparationEffort: { tone: "muted", label: "Closed, nothing to prep" },
    tradeoffHighlight: {
      strength: "matched the fast-paced variety you handled at Bambu Studio",
      caveat: "the US-hours overlap made it unworkable before the loop even continued",
    },
    verdictReasons: {
      bestForNow: "Already closed, nothing left to act on here.",
      bestLongTerm: "Withdrawn before it could test your target direction at all, no upside left to weigh.",
      safest: "Agency and client roster checked out fine, the schedule mismatch was a fit problem, not a credibility one.",
    },
  },

  // --- opp-10: Cascade AI (Saved, raw, Unknown fit) -------------------------
  {
    opportunityId: "opp-10",
    growthPotential: { tone: "muted", label: "Not yet analyzed" },
    timing: { tone: "neutral", label: "Saved · just added" },
    risk: { tone: "muted", label: "Not yet credibility-checked" },
    preparationEffort: { tone: "warning", label: "Needs Copilot's first read" },
    tradeoffHighlight: {
      strength: "sits in the same territory as Arclight, adjacent to your target direction",
      caveat: "Copilot hasn't run its full read yet, so this is still a first impression",
    },
    verdictReasons: {
      bestForNow: "Copilot hasn't run its full read yet, so there's no informed next step to take today.",
      bestLongTerm: "Adjacent territory to Arclight, but too early to judge how far it actually advances your direction.",
      safest: "Not yet credibility-checked, too early to call this safe or risky either way.",
    },
  },
];
