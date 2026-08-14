// What to offer someone staring at an empty chat.
//
// These were four fixed lines. Fixed lines go stale in one turn: the app kept
// offering "build me a CV from my profile" to a user who had built three, and
// "which direction suits me best?" to one who had named a target role on the
// onboarding screen thirty seconds earlier. A suggestion that ignores what the
// user has already done reads as a product that has not been paying attention.
//
// Four slots, each answering a different question, each resolved against state.
// Always four, and always in the same order, so the row does not reshuffle
// under someone who was reaching for the second suggestion.

import type { Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { AppState } from "@/lib/actions/types";

export function coachStarters(state: AppState): Msg[] {
  const s = messages.coach;
  const { profile, resumes, papers, pitch } = state;
  const role = profile.identity.targetRole.trim();

  return [
    // 1. The nearest concrete artefact. Building the first CV is the single
    //    most useful thing a student without one can do this week; after that
    //    the useful move is aiming an existing one at a real posting.
    resumes.length === 0 ? s.starterBuildCv : s.starterTailorCv,

    // 2. What to do with the time they have. This used to branch on whether
    //    the todo list was empty; with the list retired, the honest stand-in
    //    for "has this person started" is whether anything has been built here
    //    at all. Someone with three documents on the go needs an order to work
    //    in, not a starting point.
    resumes.length + papers.length + pitch.length === 0
      ? s.starterWhereToStart
      : s.starterPrioritise,

    // 3. The gap, named against their own target when they have given one.
    role ? s.starterGapForRole(role) : s.starterWhichDirection,

    // 4. Whatever is thinnest. No experience is the anxiety this audience
    //    actually arrives with, so it outranks the generic comparison.
    profile.experience.length === 0
      ? s.starterNoExperience
      : !profile.education.school
        ? s.starterFillProfile
        : s.starterMarketGap,
  ];
}
