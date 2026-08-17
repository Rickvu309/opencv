import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { needsOnboarding } from "@/lib/onboarding/complete";

test("a new account still needs onboarding", () => {
  assert.equal(needsOnboarding(seedState()), true);
});

test("the completion stamp skips onboarding", () => {
  const { state } = applyAction(seedState(), "onboarding.complete", {});
  assert.ok(state.onboardingCompletedAt);
  assert.equal(needsOnboarding(state), false);
});

test("an empty continue still stamps completion, so they are not asked again", () => {
  const { state } = applyAction(seedState(), "onboarding.complete", {});
  assert.equal(state.profile.identity.name, "");
  assert.equal(state.profile.identity.targetRole, "");
  assert.equal(needsOnboarding(state), false);
});

test("a name, a role, an upload, a paper, or a pitch backfills as done", () => {
  const named = applyAction(seedState(), "profile.setIdentity", {
    name: "Mai",
  }).state;
  assert.equal(needsOnboarding(named), false);

  const aimed = applyAction(seedState(), "profile.setIdentity", {
    targetRole: "Data Analyst",
  }).state;
  assert.equal(needsOnboarding(aimed), false);

  const uploaded = applyAction(seedState(), "paper.addUpload", {
    kind: "cv",
    label: "CV.pdf",
    fileName: "CV.pdf",
  }).state;
  assert.equal(needsOnboarding(uploaded), false);

  const built = applyAction(seedState(), "paper.create", {
    type: "cv",
    label: "CV",
  }).state;
  assert.equal(needsOnboarding(built), false);

  const pitched = applyAction(seedState(), "pitch.write", {
    kind: "bio",
    body: "Third-year student",
  }).state;
  assert.equal(needsOnboarding(pitched), false);
});

test("onboarding.complete is idempotent", () => {
  const first = applyAction(seedState(), "onboarding.complete", {}).state;
  const stamped = {
    ...first,
    onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
  };
  const second = applyAction(stamped, "onboarding.complete", {}).state;
  assert.equal(second.onboardingCompletedAt, "2024-01-01T00:00:00.000Z");
});
