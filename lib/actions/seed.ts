// The state a new account starts from.
//
// Empty, deliberately. There used to be a seeded demo persona here, a student
// with two CVs, three todos and a nine-item plan, and every screen quietly read
// her instead of the person signed in. That made the app impossible to try
// honestly: you filled in onboarding and the sidebar still greeted someone else.
//
// So nothing is seeded. There used to be one exception, the three plan stages,
// which were the shape of a plan rather than anyone's plan; the plan feature is
// retired and they went with it. Everything else is earned.

import { defaultLocale, type Locale } from "@/lib/i18n/locale";
import { SEED_OPENINGS } from "@/lib/search/types";
import type { AppState } from "./types";

/**
 * Empty, in English.
 */
export function seedState(locale: Locale = defaultLocale): AppState {
  return {
    locale,
    profile: {
      identity: { name: "", targetRole: "" },
      context: [],
      experience: [],
      education: { school: "", major: "", year: "", gpa: "", courses: [] },
      documents: [],
    },
    paper: [],
    pitch: [],
    // Seeded, unlike everything else here, and for a reason that survives the
    // "no demo persona" rule: these are not this person's data pretending to
    // be theirs, they are examples, marked as examples, and an empty search
    // screen teaches nobody what the fit read is for.
    openings: [...SEED_OPENINGS],
    applications: [],
  };
}
