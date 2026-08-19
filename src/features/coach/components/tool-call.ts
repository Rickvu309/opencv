const KIND_LABEL: Record<string, string> = {
  cv: "CV",
  letter: "Cover letter",
  resume: "Resume",
};

const ACTION_COPY: Record<string, { active: string; settled: string }> = {
  create: { active: "Adding", settled: "Added" },
  add: { active: "Adding", settled: "Added" },
  remove: { active: "Removing", settled: "Removed" },
  update: { active: "Updating", settled: "Updated" },
  updateBlock: { active: "Updating", settled: "Updated" },
  updateSection: { active: "Updating", settled: "Updated" },
  updateMeta: { active: "Updating", settled: "Updated" },
  updateEntry: { active: "Updating", settled: "Updated" },
  rename: { active: "Renaming", settled: "Renamed" },
  log: { active: "Logging", settled: "Logged" },
  open: { active: "Opening", settled: "Opened" },
  read: { active: "Reading", settled: "Read" },
  get: { active: "Reading", settled: "Read" },
  list: { active: "Listing", settled: "Listed" },
  publish: { active: "Publishing", settled: "Published" },
  unpublish: { active: "Unpublishing", settled: "Unpublished" },
  refresh: { active: "Refreshing", settled: "Refreshed" },
  duplicate: { active: "Duplicating", settled: "Duplicated" },
  setStatus: { active: "Updating", settled: "Updated" },
  setNotes: { active: "Updating", settled: "Updated" },
  setDeadline: { active: "Updating", settled: "Updated" },
  setTemplate: { active: "Updating", settled: "Updated" },
  setTheme: { active: "Updating", settled: "Updated" },
  tailorCv: { active: "Tailoring a CV", settled: "Tailored a CV" },
  tailorLetter: { active: "Tailoring a letter", settled: "Tailored a letter" },
  sharpenLine: { active: "Sharpening a line", settled: "Sharpened a line" },
  uploadFile: { active: "Uploading a file", settled: "Uploaded a file" },
  removeFile: { active: "Removing a file", settled: "Removed a file" },
  removeEntry: { active: "Removing an entry", settled: "Removed an entry" },
  arrange: { active: "Arranging Proof", settled: "Arranged Proof" },
};

function nounLabel(noun: string) {
  if (noun === "proof") return "Proof";
  if (noun === "app") return "";
  return noun;
}

export function toolCallCopy(name: string): { activeLabel: string; label: string } {
  const [noun = "", action = ""] = name.split(".");
  const pair = ACTION_COPY[action];
  const thing = nounLabel(noun);
  if (pair) {
    if (pair.active.includes(" ")) return { activeLabel: pair.active, label: pair.settled };
    if (!thing) return { activeLabel: pair.active, label: pair.settled };
    return { activeLabel: `${pair.active} ${thing}`, label: `${pair.settled} ${thing}` };
  }
  const words = name.replaceAll(".", " ");
  return { activeLabel: words, label: words };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function queryFromInput(input: unknown): string {
  const rec = asRecord(input);
  if (!rec) return "";
  const kind = rec.kind;
  if (typeof kind === "string") return KIND_LABEL[kind] ?? kind;
  for (const key of ["title", "query", "place", "name"] as const) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (typeof rec.id === "string") return rec.id;
  return "";
}

export function payloadText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
