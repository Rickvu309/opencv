import type { Paper, PaperType, PaperUpload } from "./types";

export type DriveFilter = "all" | PaperType | "upload";

export type DriveRow =
  | { kind: "paper"; item: Paper }
  | { kind: "upload"; item: PaperUpload };

/**
 * Drive is one stack: built papers and uploaded files. Filter, empty, and
 * air all follow from that list — not from chrome.
 */
export function driveOf(
  paper: readonly Paper[],
  uploads: readonly PaperUpload[],
  filter: DriveFilter = "all",
) {
  const empty = paper.length === 0 && uploads.length === 0;
  const uploadsOnly = paper.length === 0 && uploads.length > 0;
  const present = new Set<DriveFilter>();
  for (const item of paper) present.add(item.type);
  if (uploads.length > 0) present.add("upload");
  const active = filter === "all" || present.has(filter) ? filter : "all";
  const rows: DriveRow[] = [
    ...paper.map((item) => ({ kind: "paper" as const, item })),
    ...uploads.map((item) => ({ kind: "upload" as const, item })),
  ].filter((row) => {
    if (active === "all") return true;
    if (active === "upload") return row.kind === "upload";
    return row.kind === "paper" && row.item.type === active;
  });
  return {
    empty,
    uploadsOnly,
    present,
    showFilter: present.size > 1,
    filter: active,
    rows,
    airy: rows.length <= 4,
  };
}
