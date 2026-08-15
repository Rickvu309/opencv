/**
 * My Paper is one room. Drive and Docs are modes of the same URL.
 * Opening a built paper from the stack travels. A deep link does not.
 */

export type PaperCreating = "cv" | "letter";

export type RoomMode = "drive" | "gallery" | "letter" | "docs";

export function paperHref(
  opts: {
    id?: string;
    creating?: PaperCreating;
    format?: boolean;
    arrange?: boolean;
    fromUpload?: boolean;
  } = {},
): string {
  const params = new URLSearchParams();
  if (opts.id) params.set("id", opts.id);
  if (opts.creating) params.set("new", opts.creating);
  if (opts.format) params.set("format", "1");
  if (opts.arrange) params.set("arrange", "1");
  if (opts.fromUpload) params.set("from", "upload");
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
