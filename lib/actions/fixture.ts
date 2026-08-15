// A populated state for tests, built the only way the app can build one.
//
// The seed is empty now, so a test that wants something to edit has to make it.
// It makes it by dispatching, not by hand-writing an `AppState` literal, and
// that is the point: a fixture assembled by hand drifts from what the reducers
// actually produce, and then the tests pass against a state the app can never
// be in. Everything here goes through `applyAction`, so if an action changes
// shape the fixture changes with it.
//
// Test-only. Nothing in `app/` or `components/` imports this, so it is not in
// the bundle.

import { applyAction } from "./registry";
import { seedState } from "./seed";
import type { AppState } from "./types";

type Step = [name: string, input: unknown];

export function build(steps: Step[], from: AppState = seedState()): AppState {
  return steps.reduce(
    (state, [name, input]) => applyAction(state, name, input).state,
    from,
  );
}

/** A filled-in profile: identity, education, a course, and one experience. */
export function populated(): AppState {
  return build([
    ["profile.setIdentity", { name: "Lê Thu Hà", targetRole: "Data Analyst" }],
    ["profile.setContext", { label: "Location", value: "Hà Nội" }],
    [
      "profile.setEducation",
      { school: "Đại học Bách khoa", major: "Khoa học dữ liệu", year: "Third year", gpa: "3.2/4.0" },
    ],
    ["profile.addCourse", { name: "Google Data Analytics" }],
    [
      "profile.addExperience",
      {
        title: "Thực tập sinh phân tích",
        org: "Công ty ABC",
        period: "06/2025 – 09/2025",
        detail: "Dựng báo cáo tuần cho đội marketing",
      },
    ],
  ]);
}
