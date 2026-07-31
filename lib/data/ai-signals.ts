import type { AiSignal } from "@/lib/types";

// 4 AI signal scenarios across 4 different opportunities, each grounded in
// one seeded email from lib/data/sources.ts. Accepting any of these changes
// real store state and logs Activity with the evidence, see
// lib/store.tsx's APPROVE_AI_SIGNAL case.
export const aiSignals: AiSignal[] = [
  // Recruiter email proposes a new next action: Meridian Labs' recruiter
  // adds a new expectation for Thursday's panel, so the existing prep
  // action gets re-aimed at the new ask.
  {
    id: "signal-meridian-panel-format",
    opportunityId: "opp-6",
    kind: "next-action",
    iconKind: "email",
    signal: "Meridian Labs' recruiter added a new expectation for Thursday's panel.",
    whyItMatters:
      "The panel now wants a focused case-study walkthrough instead of open Q&A, worth re-aiming prep before Thursday.",
    evidenceId: "email-meridian-recruiter",
    proposedAction:
      "Move next action to: Prep a ten-minute case-study walkthrough for the Meridian Labs panel, not open Q&A",
    state: "proposed",
    nextActionId: "action-3",
    newVerb: "Prep a ten-minute case-study walkthrough for the Meridian Labs panel, not open Q&A",
    newRationale:
      "The recruiter's update says the panel now wants a focused case-study walkthrough instead of open Q&A.",
    previousVerb: "Prep answers for the Meridian Labs design leadership panel",
    previousRationale:
      "Panel round is scheduled and typically probes how you'd lead design decisions, not just make them.",
  },

  // Thread activity proposes a status change: Tidal Finance's recruiter
  // says they moved forward with someone else, so Applied no longer
  // reflects reality.
  {
    id: "signal-tidal-closed",
    opportunityId: "opp-5",
    kind: "status-change",
    iconKind: "status",
    signal: "Tidal Finance's recruiter says they moved forward with another candidate.",
    whyItMatters: "Applied status no longer reflects reality, worth a clean close instead of a quiet drift.",
    evidenceId: "email-tidal-cold",
    proposedAction: "Move status to: Closed",
    state: "proposed",
    newStatus: "Closed",
    previousStatus: "Applied",
  },

  // Interview scheduling signal raises urgency: Brightpath Bank's
  // committee wants an expedited follow-up call, a sign a decision is
  // close, worth a priority bump and a fresh prep action.
  {
    id: "signal-brightpath-urgency",
    opportunityId: "opp-7",
    kind: "priority-bump",
    iconKind: "urgency",
    signal: "Brightpath Bank's committee wants a follow-up call this Friday before finalizing.",
    whyItMatters:
      "A late-stage scheduling ask like this usually means a decision is close, worth treating as higher priority.",
    evidenceId: "email-brightpath-scheduling",
    proposedAction:
      "Raise priority to High and add: Confirm your start-date flexibility ahead of Friday's committee call",
    state: "proposed",
    newPriority: "High",
    previousPriority: "Medium",
    addedNextAction: {
      id: "action-brightpath-prep-call",
      opportunityId: "opp-7",
      verb: "Confirm your start-date flexibility ahead of Friday's committee call",
      rationale:
        "The committee's follow-up call is specifically about start-date flexibility, worth a clear answer ready.",
      effort: "10 min",
      dueHint: "Before Friday",
      state: "suggested",
      confidence: "Medium",
    },
  },

  // AI drafts a follow-up reply: Solace AI's referral contact checked in,
  // Copilot drafts the reply, editing adjusts the draft before it sends
  // and marks the outreach action done.
  {
    id: "signal-solace-reply-draft",
    opportunityId: "opp-1",
    kind: "draft-reply",
    iconKind: "draft",
    signal: "Solace AI's referral contact checked in about the case study.",
    whyItMatters:
      "A ready reply keeps the referral warm and shows momentum before the VP's end-of-Q3 deadline.",
    evidenceId: "email-solace-checkin",
    proposedAction: "Send this reply and mark the next action done",
    state: "proposed",
    nextActionId: "action-1",
    draftText:
      "Hi Duy, sending the case study now, thank you for checking in and for keeping the VP in the loop. Happy to jump on a quick call if useful.",
    previousNextActionState: "accepted",
  },
];
