// The state a new account starts from.
//
// Empty, deliberately. There used to be a seeded demo persona here, a student
// with two CVs, three todos and a nine-item plan, and every screen quietly read
// her instead of the person signed in. That made the app impossible to try
// honestly: you filled in onboarding and the sidebar still greeted someone else.
//
// So nothing is seeded but the language the visitor arrived in. There used to
// be one exception, the three plan stages, which were the shape of a plan
// rather than anyone's plan; the plan feature is retired and they went with it.
// Everything else is earned.

import { defaultLocale, type Locale } from "@/lib/i18n/locale";
import type { AppState } from "./types";

/**
 * `locale` is a parameter rather than a constant so the first client load can
 * pass what the browser asked for. The server always renders the default, and
 * `useSyncExternalStore` is what lets the client disagree without a flash.
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
    resumes: [],
    papers: [],
    pitch: [],
  };
}
