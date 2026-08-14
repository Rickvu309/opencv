// Situation-and-goals rows are keyed by their label, written in whichever
// language the user was reading at the time. The fill surface always shows
// the four known fields (empty ones included) so an unfilled section is a
// form, not a blank preview.

import { matchesMsg, type Locale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

export type ContextRow = { label: string; value: string };

export const contextKeys = ["gender", "birthYear", "certainty", "location"] as const;

export function contextDraft(rows: ContextRow[], locale: Locale): ContextRow[] {
  const known = contextKeys.map((key) => {
    const msg = messages.context[key];
    const existing = rows.find((row) => matchesMsg(msg, row.label));
    return {
      label: existing?.label ?? msg[locale],
      value: existing?.value ?? "",
    };
  });
  const extra = rows.filter(
    (row) => !contextKeys.some((key) => matchesMsg(messages.context[key], row.label)),
  );
  return [...known, ...extra];
}

export function filledContextRows(rows: ContextRow[]): ContextRow[] {
  return rows.filter((row) => row.value.trim());
}
