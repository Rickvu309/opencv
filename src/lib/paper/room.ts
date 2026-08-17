/**
 * My Paper is one room. Drive and Docs are modes of the same URL.
 * Opening a built paper from the stack travels. A deep link does not.
 */

export type PaperCreating = "cv" | "letter";

export type RoomMode = "drive" | "gallery" | "letter" | "docs";

export type PaperSearch = {
  id?: string;
  new?: PaperCreating;
  format?: "1";
  arrange?: "1";
  from?: "upload";
};

export type PaperHrefOpts = {
  id?: string;
  creating?: PaperCreating;
  format?: boolean;
  arrange?: boolean;
  fromUpload?: boolean;
};

/** The search object Router navigates with. Empty is Drive. */
export function paperSearch(opts: PaperHrefOpts = {}): PaperSearch {
  return {
    ...(opts.id ? { id: opts.id } : {}),
    ...(opts.creating ? { new: opts.creating } : {}),
    ...(opts.format ? { format: "1" as const } : {}),
    ...(opts.arrange ? { arrange: "1" as const } : {}),
    ...(opts.fromUpload ? { from: "upload" as const } : {}),
  };
}

/** Public string for tests and copy-paste. Serializes `paperSearch`. */
export function paperHref(opts: PaperHrefOpts = {}): string {
  const search = paperSearch(opts);
  const params = new URLSearchParams();
  if (search.id) params.set("id", search.id);
  if (search.new) params.set("new", search.new);
  if (search.format) params.set("format", search.format);
  if (search.arrange) params.set("arrange", search.arrange);
  if (search.from) params.set("from", search.from);
  const query = params.toString();
  return query ? `/paper?${query}` : "/paper";
}

export function roomMode(input: {
  id: string | null;
  creating: PaperCreating | null;
  format: boolean;
  openedType?: "cv" | "letter" | "proof" | null;
}): RoomMode {
  if (input.creating === "cv" || (input.format && input.openedType === "cv")) {
    return "gallery";
  }
  if (
    input.creating === "letter" ||
    (input.format && input.openedType === "letter")
  ) {
    return "letter";
  }
  // An id in the URL is Docs, even before the paper is found — no Drive flash.
  if (input.id) return "docs";
  return "drive";
}

/** Shared-element travel only when a Drive row is the origin, or Back reverses it. */
export function shouldTravel(kind: "open" | "back" | "land"): boolean {
  return kind === "open" || kind === "back";
}

/** Drive slab, gallery pick, and opened A4 must use this same name. */
export function sheetTransitionName(id: string): string {
  return `paper-sheet-${id}`;
}
