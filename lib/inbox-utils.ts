import { emailEvidence, meetingNoteEvidence } from "@/lib/data/sources";
import type {
  ConnectedSource,
  InboxItemLink,
  InboxItemStatus,
  SourceEvidence,
  SourceEvidenceMapsToType,
  TrackRecordEntry,
} from "@/lib/types";

// Shared read-only helpers for the synced-context inbox (/sources): merging
// the seeded evidence with live store state, and the small bits of copy
// every surface that shows a linked item needs to agree on. Kept separate
// from lib/store.tsx so the inbox list and its filters stay plain and
// testable against plain data, the same split lib/opportunity-utils.ts and
// lib/nudge-utils.ts already use.

export interface InboxItem {
  evidence: SourceEvidence;
  source: ConnectedSource;
  status: InboxItemStatus;
  linkedTarget?: InboxItemLink["linkedTarget"];
}

interface InboxSourceState {
  connectedSources: ConnectedSource[];
  inboxItemLinks: Record<string, InboxItemLink>;
}

/** Every seeded evidence item, email and meeting notes combined, regardless of live connection status. Backs lookups by id for surfaces (Rewind, the old candidate scripts) that cite specific evidence directly rather than through the live inbox. */
export function findEvidenceById(id: string): SourceEvidence | undefined {
  return [...emailEvidence, ...meetingNoteEvidence].find((evidence) => evidence.id === id);
}

/** The subject line or meeting title, whichever this evidence kind carries. */
export function evidenceTitle(evidence: SourceEvidence): string {
  return evidence.kind === "email" ? evidence.subject : evidence.title;
}

/** The sender or meeting attendees, whichever this evidence kind carries. */
export function evidenceWho(evidence: SourceEvidence): string {
  return evidence.kind === "email" ? evidence.sender : evidence.withWhom;
}

export function freshnessLabel(minutes: number): string {
  if (minutes <= 0) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/**
 * Every seeded evidence item whose source is currently connected, newest
 * first. A source that isn't connected yet (Outlook, Granola before the
 * user connects it) simply has no items here, which is what makes
 * connecting Granola "immediately seed 3 items" true: nothing is added,
 * the 3 items were always seeded, connecting just makes them visible.
 */
export function getInboxItems(state: InboxSourceState): InboxItem[] {
  const allEvidence: SourceEvidence[] = [...emailEvidence, ...meetingNoteEvidence];
  const items: InboxItem[] = [];

  for (const evidence of allEvidence) {
    const source = state.connectedSources.find((entry) => entry.id === evidence.sourceId);
    if (!source || source.status !== "connected") continue;
    const link = state.inboxItemLinks[evidence.id];
    items.push({
      evidence,
      source,
      status: link?.status ?? "needs-review",
      linkedTarget: link?.linkedTarget,
    });
  }

  return items.sort((a, b) => a.evidence.freshnessMinutesAgo - b.evidence.freshnessMinutesAgo);
}

/** Every inbox item currently linked to one specific object, for the Linked evidence block on that object's own surface (opportunity Overview, Goal card). */
export function getLinkedInboxItemsFor(
  state: InboxSourceState,
  type: SourceEvidenceMapsToType,
  id: string
): InboxItem[] {
  return getInboxItems(state).filter(
    (item) => item.status === "linked" && item.linkedTarget?.type === type && item.linkedTarget.id === id
  );
}

/** The quiet sync status line above the inbox: "Gmail synced 12 min ago, Granola synced just now." */
export function buildSyncStatusLine(sources: ConnectedSource[]): string {
  const connected = sources.filter((source) => source.status === "connected");
  if (connected.length === 0) {
    return "No sources connected yet. Connect one above to start seeing synced context here.";
  }
  return (
    connected
      .map((source) => `${source.name} synced ${freshnessLabel(source.lastSyncedMinutesAgo ?? 0)}`)
      .join(", ") + "."
  );
}

/**
 * Builds the fresh Track Record candidate "link as track record material"
 * creates: the item's own signal and extract become the drafted story, kept
 * open on skills since any inbox item can be linked this way, not just the
 * one seeded example. The id and date come from the caller (lib/store.tsx
 * already generates both for every other seeded-at-runtime object).
 */
export function buildInboxTrackRecordCandidate(
  evidence: SourceEvidence,
  sourceName: string,
  id: string,
  dateStamp: string
): TrackRecordEntry {
  return {
    id,
    title: evidenceTitle(evidence),
    story: evidence.extract,
    impact: evidence.whyItMatters,
    date: dateStamp,
    evidenceTag: "Reference quote",
    whySuggested: `Linked from ${sourceName}: ${evidence.signal}`,
    evidenceHint: `Source: ${sourceName}, ${evidenceWho(evidence)}, ${evidence.timestamp}.`,
    skillIds: [],
    status: "candidate",
  };
}
