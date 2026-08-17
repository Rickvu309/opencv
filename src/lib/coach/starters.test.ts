// The six suggestions on an empty chat. They are the only thing in the product that
// suggests what to say to the Coach, so a stale one is a wrong recommendation
// with a button attached.

import { test } from "node:test";
import assert from "node:assert/strict";

import { build, populated } from "@/lib/actions/fixture";
import { seedState } from "@/lib/actions/seed";
import { applyAction } from "@/lib/actions/registry";
import { coachStarters } from "@/lib/coach/starters";
import { messages } from "@/lib/i18n/messages";

const s = messages.coach;

test("there are always exactly six, in a stable order", () => {
  // Fixed count and fixed slot meaning: the row must not reshuffle under
  // someone who was reaching for the second chip.
  for (const state of [seedState(), populated()]) {
    const starters = coachStarters(state);
    assert.equal(starters.length, 6);
    for (const entry of starters) {
      assert.equal(typeof entry, "string");
      assert.ok(entry.length > 0);
    }
  }
});

test("a brand new account is offered the first CV, not a tailoring job", () => {
  const starters = coachStarters(seedState());
  assert.deepEqual(starters[0], s.starterBuildCv);
});

test("once a CV exists, the offer moves on", () => {
  // The regression this file exists for: the app kept offering to build a CV
  // from the profile to someone who had already built one.
  const withCv = build([["paper.create", { type: "cv", label: "CV Data Analyst" }]]);
  assert.ok(withCv.paper.length > 0, "fixture should have made a CV");
  assert.deepEqual(coachStarters(withCv)[0], s.starterTailorCv);
});

test("an empty account asks where to start; one with work asks what comes first", () => {
  // The branch used to read the todo list. With that retired, "has this person
  // started" is whether anything has been built here: a CV, a letter, a pitch.
  assert.deepEqual(coachStarters(seedState())[1], s.starterWhereToStart);

  const started = applyAction(populated(), "paper.create", {
    type: "cv",
    label: "CV, Data Analyst",
  }).state;
  assert.deepEqual(coachStarters(started)[1], s.starterPrioritise);
});

test("a named target role is used by name", () => {
  const starters = coachStarters(populated());
  assert.ok(
    starters[2].includes("Data Analyst"),
    `expected the role in the chip, got: ${starters[2]}`,
  );
  assert.ok(starters[2].includes("Data Analyst"));
});

test("with no target role, the question is which direction", () => {
  assert.deepEqual(coachStarters(seedState())[2], s.starterWhichDirection);
});

test("no experience outranks the generic market comparison", () => {
  // This is the anxiety this audience actually arrives with, so it wins the
  // last slot until they have something to put in it.
  assert.deepEqual(coachStarters(seedState())[3], s.starterNoExperience);
  assert.deepEqual(coachStarters(populated())[3], s.starterMarketGap);
});

test("someone with experience but no school is asked to finish the profile", () => {
  const state = build([
    [
      "profile.addExperience",
      { title: "Thực tập sinh", org: "ABC", period: "06/2025 – 09/2025" },
    ],
  ]);
  assert.deepEqual(coachStarters(state)[3], s.starterFillProfile);
});

test("a first letter is offered until one exists, then a review", () => {
  assert.deepEqual(coachStarters(seedState())[4], s.starterWriteLetter);
  const withLetter = build([
    ["paper.create", { type: "letter", label: "Thư Data Analyst" }],
  ]);
  assert.deepEqual(coachStarters(withLetter)[4], s.starterReviewLetter);
});

test("with nothing saved, the land-side slot is a search", () => {
  assert.deepEqual(coachStarters(seedState())[5], s.starterFindOpenings);
  assert.deepEqual(coachStarters(populated())[5], s.starterFindOpenings);
});
