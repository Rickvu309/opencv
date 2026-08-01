"use client";

import { LinkChip } from "@/components/shared/link-chip";
import { useStore } from "@/lib/store";
import type { TrackRecordEntry } from "@/lib/types";

/**
 * The named-evidence chip every proof block and claim row uses to cite a
 * backing entry: a link straight into Track Record, ringed and scrolled
 * into view there, the same deep-link pattern skill and goal evidence chips
 * already use (setTrackRecordHighlight + highlightedTrackRecordEntryId).
 */
export function TrackRecordEvidenceChip({ entry }: { entry: TrackRecordEntry }) {
  const { setTrackRecordHighlight } = useStore();
  return (
    <LinkChip href="/track-record" onClick={() => setTrackRecordHighlight(entry.id)}>
      {entry.title}
    </LinkChip>
  );
}
