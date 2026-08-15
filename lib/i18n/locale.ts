// The product is English. Copy is a plain string.

export type Locale = "en";

export const locales: Locale[] = ["en"];

/** A user-facing string. */
export type Msg = string;

/** Language of a document (CV, letter, pitch), which may differ from the UI. */
export type DocumentLanguage = "en" | "vi";

export const defaultLocale: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "en";
}

/**
 * Does this text match a known catalog entry?
 *
 * Needed because a few strings are both interface copy and stored data. A
 * profile's context rows are keyed by their label.
 */
export function matchesMsg(entry: Msg, value: string): boolean {
  return entry.trim().toLowerCase() === value.trim().toLowerCase();
}
