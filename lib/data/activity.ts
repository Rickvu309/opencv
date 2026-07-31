import type { ActivityMoment } from "@/lib/types";

// Seed activity moments per opportunity: created, Copilot analysis ran,
// status changes, notes added, and next actions accepted. Ordered oldest to
// newest within each opportunity; the Activity tab re-sorts newest first.
// Surface: /opportunities/[id] Activity tab.
export const activityMoments: ActivityMoment[] = [
  // --- opp-1: Solace AI ---------------------------------------------------
  {
    id: "activity-opp-1-created",
    opportunityId: "opp-1",
    kind: "created",
    message: "Saved to Opportunities, sourced via referral from a former Kestrel Analytics colleague.",
    createdAt: "2026-06-02",
  },
  {
    id: "activity-opp-1-analysis",
    opportunityId: "opp-1",
    kind: "copilot-analysis",
    message: "Copilot summarized the role, passed the credibility check, and judged fit as Strong with high confidence.",
    createdAt: "2026-06-02",
  },
  {
    id: "activity-opp-1-dream",
    opportunityId: "opp-1",
    kind: "dream-flagged",
    message: "Flagged as a Dream opportunity.",
    createdAt: "2026-06-03",
  },
  {
    id: "activity-opp-1-action-accepted",
    opportunityId: "opp-1",
    kind: "action-accepted",
    message: "Accepted the next action: Send your AI explainability case study to the referral contact.",
    createdAt: "2026-07-09",
  },
  {
    id: "activity-opp-1-note",
    opportunityId: "opp-1",
    kind: "note-added",
    message: "Added a note about the referral contact's Q3 timeline for filling the role.",
    createdAt: "2026-07-28",
  },

  // --- opp-2: Vanta Growth Labs --------------------------------------------
  {
    id: "activity-opp-2-created",
    opportunityId: "opp-2",
    kind: "created",
    message: "Saved to Opportunities from a job board listing.",
    createdAt: "2026-07-10",
  },
  {
    id: "activity-opp-2-analysis",
    opportunityId: "opp-2",
    kind: "copilot-analysis",
    message: "Copilot flagged the credibility check as failed: unverifiable company, and fit could not be judged responsibly.",
    createdAt: "2026-07-10",
  },
  {
    id: "activity-opp-2-note",
    opportunityId: "opp-2",
    kind: "note-added",
    message: "Added a note about holding this in Saved until the credibility flag clears.",
    createdAt: "2026-07-10",
  },

  // --- opp-3: Mekong Robotics --------------------------------------------
  {
    id: "activity-opp-3-created",
    opportunityId: "opp-3",
    kind: "created",
    message: "Saved to Opportunities from Mekong's company careers page.",
    createdAt: "2026-05-14",
  },
  {
    id: "activity-opp-3-analysis",
    opportunityId: "opp-3",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Medium: passed credibility, but flagged the hardware-adjacent domain as new territory off the AI-focused target direction.",
    createdAt: "2026-05-14",
  },
  {
    id: "activity-opp-3-note",
    opportunityId: "opp-3",
    kind: "note-added",
    message: "Added a note deprioritizing this behind the AI-focused roles for now.",
    createdAt: "2026-05-14",
  },

  // --- opp-4: Arclight AI ---------------------------------------------------
  {
    id: "activity-opp-4-created",
    opportunityId: "opp-4",
    kind: "created",
    message: "Saved to Opportunities from Arclight's company site.",
    createdAt: "2026-06-20",
  },
  {
    id: "activity-opp-4-analysis",
    opportunityId: "opp-4",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Strong: suggestion and approval surface work closely matches the Fintra trust-boundary pattern.",
    createdAt: "2026-06-20",
  },
  {
    id: "activity-opp-4-status",
    opportunityId: "opp-4",
    kind: "status-change",
    message: "Status changed to Applied.",
    createdAt: "2026-06-25",
  },
  {
    id: "activity-opp-4-note",
    opportunityId: "opp-4",
    kind: "note-added",
    message: "Added a note that the recruiter's review committee meets biweekly.",
    createdAt: "2026-07-15",
  },

  // --- opp-5: Lotus Finance --------------------------------------------------
  {
    id: "activity-opp-5-created",
    opportunityId: "opp-5",
    kind: "created",
    message: "Saved to Opportunities from recruiter outreach.",
    createdAt: "2026-06-05",
  },
  {
    id: "activity-opp-5-analysis",
    opportunityId: "opp-5",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Weak: broad, shallow scope with no AI-facing work and no remote flexibility.",
    createdAt: "2026-06-05",
  },
  {
    id: "activity-opp-5-status",
    opportunityId: "opp-5",
    kind: "status-change",
    message: "Status changed to Applied.",
    createdAt: "2026-06-08",
  },
  {
    id: "activity-opp-5-note",
    opportunityId: "opp-5",
    kind: "note-added",
    message: "Added a note that the onsite-only requirement killed enthusiasm for this one.",
    createdAt: "2026-06-22",
  },

  // --- opp-6: Meridian Labs --------------------------------------------------
  {
    id: "activity-opp-6-created",
    opportunityId: "opp-6",
    kind: "created",
    message: "Saved to Opportunities via referral from Fintra's design director.",
    createdAt: "2026-05-02",
  },
  {
    id: "activity-opp-6-analysis",
    opportunityId: "opp-6",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Strong: confidence and uncertainty surfacing closely matches the Fintra explainability panel.",
    createdAt: "2026-05-02",
  },
  {
    id: "activity-opp-6-status-applied",
    opportunityId: "opp-6",
    kind: "status-change",
    message: "Status changed to Applied.",
    createdAt: "2026-05-10",
  },
  {
    id: "activity-opp-6-status-interview",
    opportunityId: "opp-6",
    kind: "status-change",
    message: "Status changed to Interview.",
    createdAt: "2026-06-01",
  },
  {
    id: "activity-opp-6-tailoring",
    opportunityId: "opp-6",
    kind: "copilot-analysis",
    message: "Copilot drafted tailoring suggestions for the Meridian Labs CV version.",
    createdAt: "2026-07-18",
  },
  {
    id: "activity-opp-6-action-accepted",
    opportunityId: "opp-6",
    kind: "action-accepted",
    message: "Accepted the next action: Prep answers for the Meridian Labs design leadership panel.",
    createdAt: "2026-07-25",
  },
  {
    id: "activity-opp-6-note",
    opportunityId: "opp-6",
    kind: "note-added",
    message: "Added a note ahead of Thursday's panel round.",
    createdAt: "2026-07-27",
  },

  // --- opp-7: Halo Bank ------------------------------------------------
  {
    id: "activity-opp-7-created",
    opportunityId: "opp-7",
    kind: "created",
    message: "Saved to Opportunities from LinkedIn outreach.",
    createdAt: "2026-04-18",
  },
  {
    id: "activity-opp-7-analysis",
    opportunityId: "opp-7",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Medium: first-time management scope matches the leadership goal, lighter on AI-specific work.",
    createdAt: "2026-04-18",
  },
  {
    id: "activity-opp-7-status-applied",
    opportunityId: "opp-7",
    kind: "status-change",
    message: "Status changed to Applied.",
    createdAt: "2026-04-25",
  },
  {
    id: "activity-opp-7-status-interview",
    opportunityId: "opp-7",
    kind: "status-change",
    message: "Status changed to Interview.",
    createdAt: "2026-06-01",
  },
  {
    id: "activity-opp-7-action-accepted",
    opportunityId: "opp-7",
    kind: "action-accepted",
    message: "Accepted the next action: Send a thank-you note after the Halo Bank final loop.",
    createdAt: "2026-07-15",
  },
  {
    id: "activity-opp-7-note",
    opportunityId: "opp-7",
    kind: "note-added",
    message: "Added a note that the final loop felt strong, waiting on the committee.",
    createdAt: "2026-07-20",
  },

  // --- opp-8: Orbit Logistics --------------------------------------------------
  {
    id: "activity-opp-8-created",
    opportunityId: "opp-8",
    kind: "created",
    message: "Saved to Opportunities from Orbit's company site.",
    createdAt: "2026-05-25",
  },
  {
    id: "activity-opp-8-analysis",
    opportunityId: "opp-8",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Strong: console-design scope is a clean match for dashboard and operational-tooling experience.",
    createdAt: "2026-05-25",
  },
  {
    id: "activity-opp-8-status-applied",
    opportunityId: "opp-8",
    kind: "status-change",
    message: "Status changed to Applied.",
    createdAt: "2026-06-01",
  },
  {
    id: "activity-opp-8-status-interview",
    opportunityId: "opp-8",
    kind: "status-change",
    message: "Status changed to Interview.",
    createdAt: "2026-06-20",
  },
  {
    id: "activity-opp-8-status-offer",
    opportunityId: "opp-8",
    kind: "status-change",
    message: "Status changed to Offer.",
    createdAt: "2026-07-20",
  },
  {
    id: "activity-opp-8-note",
    opportunityId: "opp-8",
    kind: "note-added",
    message: "Added a note comparing the offer against target compensation.",
    createdAt: "2026-07-29",
  },

  // --- opp-9: Vela Studio (closed) ---------------------------------------------
  {
    id: "activity-opp-9-created",
    opportunityId: "opp-9",
    kind: "created",
    message: "Saved to Opportunities from a job board listing.",
    createdAt: "2026-04-02",
  },
  {
    id: "activity-opp-9-analysis",
    opportunityId: "opp-9",
    kind: "copilot-analysis",
    message: "Copilot judged fit as Weak: agency staffing model offers little continuity toward the target direction.",
    createdAt: "2026-04-02",
  },
  {
    id: "activity-opp-9-status-applied",
    opportunityId: "opp-9",
    kind: "status-change",
    message: "Status changed to Applied.",
    createdAt: "2026-04-05",
  },
  {
    id: "activity-opp-9-status-closed",
    opportunityId: "opp-9",
    kind: "status-change",
    message: "Status changed to Closed.",
    createdAt: "2026-04-18",
  },
  {
    id: "activity-opp-9-note",
    opportunityId: "opp-9",
    kind: "note-added",
    message: "Added a note that timezone overlap made this unworkable, closing it out with no regrets.",
    createdAt: "2026-04-20",
  },

  // --- opp-10: Cascade AI ---------------------------------------------------
  {
    id: "activity-opp-10-created",
    opportunityId: "opp-10",
    kind: "created",
    message: "Saved to Opportunities from a job board listing.",
    createdAt: "2026-07-29",
  },
];
