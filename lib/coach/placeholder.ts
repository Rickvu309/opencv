/**
 * What the composer suggests you might type.
 *
 * The suggestions under an empty chat already pick four questions from state. The
 * field itself used to say the same "Hỏi Coach…" on every screen, which taught
 * nothing. These hints are that pool, plus one line for the page you are on
 * when the dock is open over CV, Search, and the rest.
 */

import type { Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { AppState } from "@/lib/actions/types";
import { coachStarters } from "@/lib/coach/starters";

/** How long an empty composer keeps one hint before the next. */
export const COMPOSER_HINT_MS = 5500;

export type CyclingHint = {
  current: string;
  previous: string | null;
};

/**
 * The pair an overlay needs to crossfade.
 *
 * A native `placeholder` cannot fade, so the composer paints the incoming line
 * over the one it replaced. `index` is the incoming hint. After a cycle
 * (`swapped`), `previous` is the outgoing one, including wrap-around from last
 * to first. Before the first tick, and when there is only one line, there is
 * nothing to fade from.
 */
export function cyclingHint(
  hints: readonly string[],
  index: number,
  swapped: boolean,
): CyclingHint {
  if (hints.length === 0) return { current: "", previous: null };
  const i = ((index % hints.length) + hints.length) % hints.length;
  const current = hints[i] ?? "";
  if (!swapped || hints.length < 2) return { current, previous: null };
  const prevIndex = (i - 1 + hints.length) % hints.length;
  return { current, previous: hints[prevIndex] ?? null };
}

export function composerHints(pathname: string, state: AppState): Msg[] {
  const starters = coachStarters(state);
  const extra = hintForPath(pathname);
  return extra ? [extra, ...starters] : starters;
}

function hintForPath(pathname: string): Msg | null {
  if (pathname.startsWith("/cv")) return messages.coach.hintCv;
  if (pathname.startsWith("/papers")) return messages.coach.hintPapers;
  if (pathname.startsWith("/pitch")) return messages.coach.hintPitch;
  if (pathname.startsWith("/search")) return messages.coach.hintSearch;
  if (pathname.startsWith("/applications")) return messages.coach.hintApplications;
  if (pathname.startsWith("/profile")) return messages.coach.hintProfile;
  return null;
}
