import type { AppState } from "@/lib/actions/types";

/**
 * Whether this account still needs the first-run screen.
 *
 * The flag is the truth once they have continued, even with every field
 * blank. Older accounts never got that stamp, so a name, a goal, or anything
 * already made is treated as done rather than sending them through setup again.
 */
export function needsOnboarding(state: AppState): boolean {
  if (state.onboardingCompletedAt) return false;
  const { name, targetRole } = state.profile.identity;
  if (name.trim() || targetRole.trim()) return false;
  if (state.uploads.length > 0 || state.paper.length > 0 || state.pitch.length > 0) {
    return false;
  }
  return true;
}
