// The checklist reads the store rather than remembering ticks, so what has to
// be true is that each step's question matches the step's promise. A list that
// says "add a course" and ticks when you add an experience teaches the wrong
// thing about the product.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { checklistComplete, checklistSteps } from "@/lib/onboarding/checklist";

const done = (state: Parameters<typeof checklistSteps>[0], talked = false) =>
  checklistSteps(state, talked)
    .filter((step) => step.done)
    .map((step) => step.id);

test("AC-ONB-003.1: a new account has all four steps, none done", () => {
  const steps = checklistSteps(seedState(), false);
  assert.deepEqual(
    steps.map((step) => step.id),
    ["goal", "facts", "document", "coach"],
  );
  assert.equal(checklistComplete(steps), false);
});

test("AC-ONB-003.2: setting a goal ticks the goal step and nothing else", () => {
  const state = applyAction(seedState(), "profile.setIdentity", {
    targetRole: "Data Analyst",
  }).state;
  assert.deepEqual(done(state), ["goal"]);
});

test("a course or an experience ticks the facts step", () => {
  // Either one. The step is "get past an empty profile", not "add a course".
  const withCourse = applyAction(seedState(), "profile.addCourse", {
    name: "SQL cơ bản",
  }).state;
  assert.deepEqual(done(withCourse), ["facts"]);

  const withExperience = applyAction(seedState(), "profile.addExperience", {
    title: "Thực tập sinh",
    org: "Công ty ABC",
    period: "2025",
    detail: "Dựng báo cáo",
  }).state;
  assert.deepEqual(done(withExperience), ["facts"]);
});

test("anything produced here ticks the document step", () => {
  // A CV, a letter, or a line of pitch. The step is "you have made something
  // with this", and insisting on a CV would leave somebody who wrote a cover
  // letter first staring at an unticked box.
  for (const [action, input] of [
    ["paper.create", { type: "cv", label: "CV" }],
    ["paper.create", { type: "letter", label: "Thư" }],
    ["pitch.write", { kind: "bio", body: "Sinh viên năm ba" }],
  ] as const) {
    const state = applyAction(seedState(), action, input).state;
    assert.deepEqual(done(state), ["document"], `${action} should tick it`);
  }
});

test("talking to the Coach ticks the last step", () => {
  assert.deepEqual(done(seedState(), true), ["coach"]);
});

test("the list disappears only when every step is done", () => {
  let state = applyAction(seedState(), "profile.setIdentity", {
    targetRole: "Data Analyst",
  }).state;
  state = applyAction(state, "profile.addCourse", { name: "SQL" }).state;
  state = applyAction(state, "paper.create", { type: "cv", label: "CV" }).state;

  assert.equal(checklistComplete(checklistSteps(state, false)), false);
  assert.equal(checklistComplete(checklistSteps(state, true)), true);
});

test("every step has a label and points somewhere", () => {
  for (const step of checklistSteps(seedState(), false)) {
    assert.ok(step.label.trim().length > 0, `${step.id} has no label`);
    assert.match(step.href, /^\//, `${step.id} has no destination`);
  }
});
