// Two languages, neither one a translation of the other.
//
// `PRODUCT.md` says the voice is "Vietnamese-first, natural not translated".
// That cuts both ways once English exists: Vietnamese written to fit an English
// sentence reads like a manual, and English written to mirror Vietnamese reads
// like a machine. So every entry in `messages.ts` is a pair written twice, not
// a string and its translation, and the two are allowed to differ in structure
// where the idiom differs.

export type Locale = "vi" | "en";

export const locales: Locale[] = ["en", "vi"];

/** A string in both languages. The unit everything user-facing is stored in. */
export type Msg = Record<Locale, string>;

/**
 * Each language names itself in its own language. A menu that offers
 * "Vietnamese" to someone who only reads Vietnamese is a menu they cannot use.
 */
export const localeNames: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export const defaultLocale: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "en";
}

/**
 * Does this text match either language of a known entry?
 *
 * Needed because a few strings are both interface copy and stored data. A
 * profile's context rows are keyed by their label, and the label was written in
 * whichever language the user was reading at the time, so "Location" and "Địa
 * điểm" have to be recognised as the same row.
 */
export function matchesMsg(entry: Msg, value: string): boolean {
  const needle = value.trim().toLowerCase();
  return locales.some((locale) => entry[locale].toLowerCase() === needle);
}

/**
 * Letters and tone marks that only Vietnamese uses.
 *
 * Deliberately not "any diacritic". The obvious version — look for a combining
 * mark — flags "résumé" and "café", which are ordinary words in an English
 * conversation about careers, and flipping someone into Vietnamese for writing
 * "résumé" is worse than not flipping them at all.
 *
 * These two sets have no such overlap. The letters ăâđêôơư exist in no other
 * language this app will meet, and the hook-above and dot-below tone marks are
 * Vietnamese-only among the Latin scripts. Between them they catch almost any
 * real Vietnamese sentence: mình, bạn, nên, được, hồ sơ, công việc, cảm ơn.
 */
const VIETNAMESE_LETTERS = /[ăâđêôơư]/i;
// U+0309 hook above (dấu hỏi), U+0323 dot below (dấu nặng). Built from
// escapes, not written literally: a bare combining mark in source is
// invisible in every editor and attaches itself to the bracket beside it.
const VIETNAMESE_TONES = new RegExp("[\\u0309\\u0323]");

/**
 * Is this written in Vietnamese?
 *
 * Presence is proof; absence proves nothing, because Vietnamese is often typed
 * without diacritics ("minh nen lam gi"). So this only ever answers "yes, this
 * is Vietnamese", and callers must not read a false as "this is English".
 */
export function looksVietnamese(text: string): boolean {
  return (
    VIETNAMESE_LETTERS.test(text) ||
    VIETNAMESE_TONES.test(text.normalize("NFD"))
  );
}

/**
 * Pick a starting language from the browser.
 *
 * Only ever used for a first visit; once the user has chosen, the choice is in
 * `AppState` and wins. English is the default rather than the fallback: the
 * switcher is one tap away, and an unconfigured browser should land on the
 * language a first-time visitor can read without guessing.
 */
export function preferredLocale(
  languages: readonly string[] | undefined,
): Locale {
  // `navigator.languages` is absent in older WebViews and in any environment
  // that supplies a partial `window`. Not knowing is the same as not matching.
  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "vi") return "vi";
    if (base === "en") return "en";
  }
  return defaultLocale;
}
