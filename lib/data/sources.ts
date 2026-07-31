import type { ConnectedSource, EmailEvidence, MeetingNoteEvidence } from "@/lib/types";

// The connected-sources registry (simulated only, nothing here reaches a
// real inbox). Gmail is connected from the ticket 17 seed data; Outlook and
// Granola start not connected so /sources has a real onboarding moment to
// demonstrate. Extensible: a future source adds a new ConnectedSourceType
// and a row here.
// Surface: /sources, plus every evidence chip and extract app-wide
// (components/ai/evidence-chip.tsx, components/ai/evidence-extract.tsx).
export const connectedSources: ConnectedSource[] = [
  {
    id: "source-gmail",
    type: "email",
    name: "Gmail",
    category: "Email",
    status: "connected",
    lastSyncedMinutesAgo: 12,
    readsDescription:
      "Recruiter replies, interview scheduling threads, and offer or rejection notices tied to your opportunities, plus internal work threads worth capturing in Track Record.",
    unlocksDescription:
      "Recruiter replies and scheduling threads turn into next-action updates and status changes you approve, and work threads become Track Record candidates.",
  },
  {
    id: "source-outlook",
    type: "email",
    name: "Outlook",
    category: "Email",
    status: "not-connected",
    readsDescription:
      "The same recruiter replies, scheduling threads, and offer or rejection notices, read from an Outlook inbox instead of Gmail.",
    unlocksDescription:
      "A second inbox feeding the same synced-context inbox and evidence trail Gmail already powers.",
  },
  {
    id: "source-granola",
    type: "meetingNotes",
    name: "Granola",
    category: "Meeting notes",
    status: "not-connected",
    readsDescription:
      "Meeting notes from calls you take in Granola: panel prep, design reviews, and conversations worth remembering.",
    unlocksDescription: "Meeting notes become track record evidence and goal context without retyping anything.",
  },
];

// 9 seeded email extracts: 7 tied to specific opportunities, 2 tied to work
// activity for Track Record capture. Every AI proposal or inbox row that
// cites one of these shows it as an EvidenceChip plus an expandable
// EvidenceExtract.
export const emailEvidence: EmailEvidence[] = [
  {
    id: "email-meridian-recruiter",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Jordan Ellis",
    subject: "Panel round update, one small addition",
    timestamp: "2h ago",
    freshnessMinutesAgo: 120,
    extract:
      "Hi Mai, panel is still on for Thursday. One addition: the panel wants a short walkthrough of one case study rather than open Q&A only, keep it to about ten minutes.",
    mapsToType: "opportunity",
    mapsToId: "opp-6",
    mapsToLabel: "Meridian Labs",
    signal: "Jordan adds a new ask for Thursday's panel.",
    whyItMatters: "Changes what prep should focus on before Thursday.",
    usesNext: "May prompt another next-action update if the panel format changes again.",
  },
  {
    id: "email-brightpath-scheduling",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Thao Bui",
    subject: "Quick follow-up call, this Friday?",
    timestamp: "5h ago",
    freshnessMinutesAgo: 300,
    extract:
      "The committee would like a short follow-up call this Friday before they finalize, mainly to confirm your start-date flexibility. Let me know a time that works.",
    mapsToType: "opportunity",
    mapsToId: "opp-7",
    mapsToLabel: "Halo Bank",
    signal: "Thao proposes a follow-up call this Friday.",
    whyItMatters: "A late scheduling ask like this usually means a decision is close.",
    usesNext: "May factor into the priority read on this opportunity.",
  },
  {
    id: "email-orbit-offer",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Daniel Cho",
    subject: "Your offer from Orbit Logistics",
    timestamp: "Yesterday",
    freshnessMinutesAgo: 1440,
    extract:
      "Attached is your formal offer for Senior Product Designer. Base is $118,000, matching what we discussed. The offer is open until August 12.",
    mapsToType: "opportunity",
    mapsToId: "opp-8",
    mapsToLabel: "Orbit Logistics",
    signal: "Daniel sends the formal offer, open until August 12.",
    whyItMatters: "A live offer with a deadline is worth acting on deliberately.",
    usesNext: "May anchor the offer-decision next action once you're ready to respond.",
  },
  {
    id: "email-northwind-silence",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Mai Tran (sent)",
    subject: "Checking in on the Product Design Lead role",
    timestamp: "11 weeks ago",
    freshnessMinutesAgo: 110880,
    extract:
      "Hi team, wanted to check in on the Product Design Lead posting, still very interested if the search is active. No reply since this was sent.",
    mapsToType: "opportunity",
    mapsToId: "opp-3",
    mapsToLabel: "Mekong Robotics",
    hedge: "Might be stale enough to also warrant a check-in nudge.",
    signal: "No reply since Mai's check-in eleven weeks ago.",
    whyItMatters: "Prolonged silence is worth naming honestly, not just letting it sit.",
    usesNext: "May support a stale-opportunity nudge if the silence continues.",
  },
  {
    id: "email-vela-rejection",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Vela Studio Recruiting",
    subject: "Update on your application",
    timestamp: "2026-04-18",
    freshnessMinutesAgo: 149760,
    extract:
      "Thanks for your interest and for the time you put into the first screen. We won't be moving forward given the timezone overlap requirement.",
    mapsToType: "opportunity",
    mapsToId: "opp-9",
    mapsToLabel: "Vela Studio",
    signal: "Vela Studio passes, citing timezone overlap.",
    whyItMatters: "Closes the loop so the board reflects reality.",
    usesNext: "May confirm this opportunity should move to Closed.",
  },
  {
    id: "email-tidal-cold",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Long Pham",
    subject: "Re: Senior Product Designer application",
    timestamp: "3 days ago",
    freshnessMinutesAgo: 4320,
    extract:
      "Thanks again for applying. We've moved forward with another candidate for this role, so we're closing out your application for now.",
    mapsToType: "opportunity",
    mapsToId: "opp-5",
    mapsToLabel: "Lotus Finance",
    signal: "Lotus Finance moves forward with another candidate.",
    whyItMatters: "Applied no longer reflects where this actually stands.",
    usesNext: "Already grounds the suggested status change to Closed.",
  },
  {
    id: "email-solace-checkin",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Duy Nguyen",
    subject: "Any update on the case study?",
    timestamp: "1h ago",
    freshnessMinutesAgo: 60,
    extract:
      "Hey Mai, just checking in, happy to route the case study to the VP whenever it's ready. Wanted you to know the role is still open on their end.",
    mapsToType: "opportunity",
    mapsToId: "opp-1",
    mapsToLabel: "Solace AI",
    signal: "Duy checks in and offers to route the case study.",
    whyItMatters: "Keeps the referral warm ahead of the VP's deadline.",
    usesNext: "Already grounds the drafted reply next action.",
  },
  {
    id: "email-trackrecord-heuristic",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Ravi Desai",
    subject: "Recap: Tuesday's AI review sync",
    timestamp: "2 days ago",
    freshnessMinutesAgo: 2880,
    extract:
      "Recapping the credibility-check heuristic we landed on for low-confidence underwriting cases, already referencing it in this week's model review notes.",
    mapsToType: "trackRecord",
    mapsToId: "tre-11",
    mapsToLabel: "Credibility-check heuristic",
    signal: "Ravi recaps the credibility-check heuristic from Tuesday's sync.",
    whyItMatters: "Reads as track record material already cited in this week's model review.",
    usesNext: "Already grounds the Track Record candidate drafted from this thread.",
  },
  {
    id: "email-trackrecord-trustcues",
    sourceId: "source-gmail",
    kind: "email",
    sender: "Hana Kobayashi",
    subject: "Trust-cue sessions, quick notes",
    timestamp: "1 day ago",
    freshnessMinutesAgo: 1440,
    extract:
      "Sharing quick notes from the three sessions this week on how beta users react to the confidence indicator, worth writing up before it fades.",
    mapsToType: "trackRecord",
    mapsToId: "tre-12",
    mapsToLabel: "Trust-cue research sprint",
    signal: "Hana shares notes from three trust-cue research sessions.",
    whyItMatters: "Worth capturing before the detail fades.",
    usesNext: "Already grounds the Track Record candidate drafted from this thread.",
  },
];

// 3 seeded Granola meeting-note items, only visible in the synced-context
// inbox once Granola is connected. Panel-prep debrief, a design-review recap
// that is track record material, and a mentor conversation about direction.
export const meetingNoteEvidence: MeetingNoteEvidence[] = [
  {
    id: "meeting-panel-prep",
    sourceId: "source-granola",
    kind: "meetingNotes",
    withWhom: "Prep call with Linh Vu",
    title: "Panel prep debrief: Meridian Labs case-study walkthrough",
    timestamp: "3h ago",
    freshnessMinutesAgo: 180,
    extract:
      "Ran through the ten-minute case-study walkthrough twice, tightened the opening frame and cut the middle section down so the trust-boundary decision lands with more room to spare.",
    mapsToType: "opportunity",
    mapsToId: "opp-6",
    mapsToLabel: "Meridian Labs",
    signal: "Rehearsed the ten-minute case-study walkthrough twice ahead of Thursday.",
    whyItMatters: "Confirms the panel's new format is ready to go, worth attaching as prep evidence.",
    usesNext: "May attach as evidence the next time this panel-prep next action is reviewed.",
  },
  {
    id: "meeting-design-review",
    sourceId: "source-granola",
    kind: "meetingNotes",
    withWhom: "Design review with Minh Chau and the assistant team",
    title: "Design review recap: assistant confidence indicator",
    timestamp: "Yesterday",
    freshnessMinutesAgo: 1440,
    extract:
      "Minh called the confidence-indicator rework some of the clearest systems thinking he's seen on the assistant, specifically how the trust-boundary rules stayed visible through every state change.",
    mapsToType: "trackRecord",
    mapsToId: "",
    mapsToLabel: "Track record candidate",
    signal: "Minh Chau called the confidence-indicator rework some of the clearest systems thinking on the assistant.",
    whyItMatters: "A peer's direct account of trust-boundary systems thinking is track record material.",
    usesNext: "May become a Track Record candidate once you link it.",
  },
  {
    id: "meeting-mentor-conversation",
    sourceId: "source-granola",
    kind: "meetingNotes",
    withWhom: "Conversation with Linh Vu",
    title: "Mentor conversation: IC track vs design-lead path",
    timestamp: "2 days ago",
    freshnessMinutesAgo: 2880,
    extract:
      "Linh pushed back on rushing into a design-lead title just because Halo Bank offered one, and asked whether staying IC on AI-native product design for another year might actually get Mai closer to the staff-level work she wants.",
    mapsToType: "goal",
    mapsToId: "goal-3",
    mapsToLabel: "Grow into people leadership",
    hedge: "Could also belong to landing a senior or staff AI product design role.",
    signal: "Linh questioned whether the design-lead path is the fastest route to the work Mai actually wants.",
    whyItMatters: "Worth attaching to the goal it's actually about before the reasoning fades.",
    usesNext: "May inform the next progress note on whichever goal you link it to.",
  },
];
