// The state a new account starts from.
//
// Empty, deliberately. There used to be a seeded demo persona here, a student
// with two CVs, three todos and a nine-item plan, and every screen quietly read
// her instead of the person signed in. That made the app impossible to try
// honestly: you filled in onboarding and the sidebar still greeted someone else.
//
// So the only thing seeded now is *structure*: the three plan stages, which are
// the shape of a plan rather than anyone's plan. Everything else is earned.

import { planStageTemplate } from "@/lib/catalog";
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
    todos: [],
    plan: {
      stages: planStageTemplate.map((stage) => ({
        id: stage.id,
        // Resolved once, here: from this point the label is stored text the
        // user can rename, not a string the app keeps re-deciding.
        label: stage.label[locale],
        period: stage.period[locale],
        entries: [],
      })),
    },
    resumes: [],
    papers: [],
    paths: {
      // No goal until the user picks one. Lighting a route to a role nobody
      // chose is the map asserting something it has not been told.
      targetId: null,
      customNodes: [],
      customEdges: [],
    },
  };
}
