import type { ConnectedSource, EmailEvidence } from "@/lib/types";

// The connected-sources registry (simulated only, nothing here reaches a
// real inbox). One source for this ticket, Email, left extensible: a
// future source adds a new ConnectedSourceType and a row here.
export const connectedSources: ConnectedSource[] = [
  {
    id: "source-email",
    type: "email",
    name: "Email",
    provider: "Gmail",
    status: "connected",
    lastSyncedMinutesAgo: 12,
    readsDescription:
      "Recruiter replies, interview scheduling threads, and offer or rejection notices tied to your opportunities, plus internal work threads worth capturing in Track Record.",
  },
];

// 9 seeded email extracts: 7 tied to specific opportunities, 2 tied to work
// activity for Track Record capture. Every AI proposal that cites one of
// these shows it as an EvidenceChip plus an expandable EvidenceExtract.
export const emailEvidence: EmailEvidence[] = [
  {
    id: "email-meridian-recruiter",
    sourceId: "source-email",
    sender: "Jordan Ellis",
    subject: "Panel round update, one small addition",
    timestamp: "2h ago",
    extract:
      "Hi Mai, panel is still on for Thursday. One addition: the panel wants a short walkthrough of one case study rather than open Q&A only, keep it to about ten minutes.",
    mapsToType: "opportunity",
    mapsToId: "opp-6",
    mapsToLabel: "Meridian Labs",
  },
  {
    id: "email-brightpath-scheduling",
    sourceId: "source-email",
    sender: "Priya Shah",
    subject: "Quick follow-up call, this Friday?",
    timestamp: "5h ago",
    extract:
      "The committee would like a short follow-up call this Friday before they finalize, mainly to confirm your start-date flexibility. Let me know a time that works.",
    mapsToType: "opportunity",
    mapsToId: "opp-7",
    mapsToLabel: "Brightpath Bank",
  },
  {
    id: "email-orbit-offer",
    sourceId: "source-email",
    sender: "Daniel Cho",
    subject: "Your offer from Orbit Logistics",
    timestamp: "Yesterday",
    extract:
      "Attached is your formal offer for Senior Product Designer. Base is $118,000, matching what we discussed. The offer is open until August 12.",
    mapsToType: "opportunity",
    mapsToId: "opp-8",
    mapsToLabel: "Orbit Logistics",
  },
  {
    id: "email-northwind-silence",
    sourceId: "source-email",
    sender: "Mai Tran (sent)",
    subject: "Checking in on the Product Design Lead role",
    timestamp: "11 weeks ago",
    extract:
      "Hi team, wanted to check in on the Product Design Lead posting, still very interested if the search is active. No reply since this was sent.",
    mapsToType: "opportunity",
    mapsToId: "opp-3",
    mapsToLabel: "Northwind Robotics",
  },
  {
    id: "email-vela-rejection",
    sourceId: "source-email",
    sender: "Vela Studio Recruiting",
    subject: "Update on your application",
    timestamp: "2026-04-18",
    extract:
      "Thanks for your interest and for the time you put into the first screen. We won't be moving forward given the timezone overlap requirement.",
    mapsToType: "opportunity",
    mapsToId: "opp-9",
    mapsToLabel: "Vela Studio",
  },
  {
    id: "email-tidal-cold",
    sourceId: "source-email",
    sender: "Long Pham",
    subject: "Re: Senior Product Designer application",
    timestamp: "3 days ago",
    extract:
      "Thanks again for applying. We've moved forward with another candidate for this role, so we're closing out your application for now.",
    mapsToType: "opportunity",
    mapsToId: "opp-5",
    mapsToLabel: "Tidal Finance",
  },
  {
    id: "email-solace-checkin",
    sourceId: "source-email",
    sender: "Duy Nguyen",
    subject: "Any update on the case study?",
    timestamp: "1h ago",
    extract:
      "Hey Mai, just checking in, happy to route the case study to the VP whenever it's ready. Wanted you to know the role is still open on their end.",
    mapsToType: "opportunity",
    mapsToId: "opp-1",
    mapsToLabel: "Solace AI",
  },
  {
    id: "email-trackrecord-heuristic",
    sourceId: "source-email",
    sender: "Ravi Desai",
    subject: "Recap: Tuesday's AI review sync",
    timestamp: "2 days ago",
    extract:
      "Recapping the credibility-check heuristic we landed on for low-confidence underwriting cases, already referencing it in this week's model review notes.",
    mapsToType: "trackRecord",
    mapsToId: "tre-11",
    mapsToLabel: "Credibility-check heuristic",
  },
  {
    id: "email-trackrecord-trustcues",
    sourceId: "source-email",
    sender: "Hana Kobayashi",
    subject: "Trust-cue sessions, quick notes",
    timestamp: "1 day ago",
    extract:
      "Sharing quick notes from the three sessions this week on how beta users react to the confidence indicator, worth writing up before it fades.",
    mapsToType: "trackRecord",
    mapsToId: "tre-12",
    mapsToLabel: "Trust-cue research sprint",
  },
];
