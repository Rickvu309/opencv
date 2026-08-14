import { test } from "node:test";
import assert from "node:assert/strict";

import { seedState } from "@/lib/actions/seed";
import { applyAction } from "@/lib/actions/registry";
import { nextStepOf } from "@/lib/next-step";

test("no goal points at the profile", () => {
  const step = nextStepOf(seedState());
  assert.equal(step.href, "/profile");
  assert.equal(step.label.en, "Set a direction");
});

test("a goal without facts still asks for one thing done", () => {
  const { state } = applyAction(seedState(), "profile.setIdentity", {
    name: "Linh",
    targetRole: "Data Analyst",
  });
  const step = nextStepOf(state);
  assert.equal(step.href, "/profile");
  assert.equal(step.label.en, "Add something you've done");
});

test("facts without a CV point at the builder", () => {
  const goal = applyAction(seedState(), "profile.setIdentity", {
    name: "Linh",
    targetRole: "Data Analyst",
  }).state;
  const { state } = applyAction(goal, "profile.addExperience", {
    title: "Intern",
    org: "Acme",
    period: "2025",
    detail: "",
  });
  assert.equal(nextStepOf(state).href, "/cv");
});
