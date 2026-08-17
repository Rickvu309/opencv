import { test } from "node:test";
import assert from "node:assert/strict";

import { seedState } from "@/lib/actions/seed";
import { composerHints, cyclingHint } from "@/lib/coach/placeholder";
import { coachStarters } from "@/lib/coach/starters";
import { messages } from "@/lib/i18n/messages";

test("the Coach page cycles the starters, nothing extra", () => {
  const state = seedState();
  assert.deepEqual(composerHints("/coach", state), coachStarters(state));
});

test("an artefact screen leads with a hint for that screen", () => {
  const state = seedState();
  const hints = composerHints("/paper", state);
  assert.deepEqual(hints[0], messages.coach.hintCv);
  assert.deepEqual(hints.slice(1), coachStarters(state));
});

test("search, pitch, applications and profile each have their own lead", () => {
  const state = seedState();
  assert.equal(composerHints("/search", state)[0], messages.coach.hintSearch);
  assert.equal(composerHints("/pitch", state)[0], messages.coach.hintPitch);
  assert.equal(
    composerHints("/applications", state)[0],
    messages.coach.hintApplications,
  );
  assert.equal(composerHints("/profile", state)[0], messages.coach.hintProfile);
});

test("a swap names the outgoing hint separately from the incoming one", () => {
  const hints = ["one", "two", "three"];
  assert.deepEqual(cyclingHint(hints, 0, false), {
    current: "one",
    previous: null,
  });
  assert.deepEqual(cyclingHint(hints, 1, true), {
    current: "two",
    previous: "one",
  });
  assert.deepEqual(cyclingHint(hints, 2, true), {
    current: "three",
    previous: "two",
  });
  assert.deepEqual(cyclingHint(hints, 0, true), {
    current: "one",
    previous: "three",
  });
});

test("a single hint has nothing to fade from", () => {
  assert.deepEqual(cyclingHint(["only"], 0, true), {
    current: "only",
    previous: null,
  });
});
