"use client";

import { useAppState } from "@/lib/actions/store";
import type { Locale, Msg } from "./locale";
import { messages } from "./messages";

/**
 * The current language, and a function that resolves a message in it.
 *
 * No context provider: the language is part of `AppState`, so it arrives
 * through the store every component already reads. One source of truth, and the
 * Coach can change it through `settings.setLanguage` like any other edit.
 *
 * Usage stays one line at the call site:
 *
 * ```tsx
 * const { t, m } = useT();
 * <Button>{t(m.common.save)}</Button>
 * <p>{t(m.profile.itemCount(items.length))}</p>
 * ```
 *
 * Entries that take a value are functions returning a `Msg`, so a count or a
 * name is placed by each language's own word order rather than concatenated
 * around it.
 */
export function useT(): { locale: Locale; t: (entry: Msg) => string; m: typeof messages } {
  const { locale } = useAppState();
  return { locale, t: (entry) => entry[locale], m: messages };
}
