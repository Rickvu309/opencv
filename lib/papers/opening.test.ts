import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { letterTargets, openingForPaper } from "@/lib/papers/opening";
import { SEED_OPENINGS } from "@/lib/search/types";

const opening = SEED_OPENINGS[0];

test("seeded examples are not letter targets", () => {
  assert.deepEqual(letterTargets(seedState()), []);
});

test("a saved opening becomes a letter target", () => {
  const { state } = applyAction(seedState(), "opening.save", { id: opening.id });
  const targets = letterTargets(state);
  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.opening.id, opening.id);
  assert.equal(targets[0]?.applicationId, undefined);
});

test("an application is preferred over a bare saved opening", () => {
  let state = applyAction(seedState(), "opening.save", { id: opening.id }).state;
  state = applyAction(state, "application.create", { openingId: opening.id }).state;
  const targets = letterTargets(state);
  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.opening.id, opening.id);
  assert.equal(targets[0]?.applicationId, state.applications[0]?.id);
});

test("a tailored letter points back at the opening", () => {
  let state = applyAction(seedState(), "opening.save", { id: opening.id }).state;
  state = applyAction(state, "application.create", { openingId: opening.id }).state;
  state = applyAction(state, "application.tailorLetter", {
    id: state.applications[0].id,
    label: "Thư · Data",
    targetRole: opening.title,
  }).state;
  const paper = state.papers[0];
  assert.ok(paper);
  const found = openingForPaper(state, paper.id);
  assert.equal(found?.id, opening.id);
});

test("an unbound letter has no opening", () => {
  const { state } = applyAction(seedState(), "paper.create", {
    kind: "cover-letter",
    label: "Thư",
  });
  assert.equal(openingForPaper(state, state.papers[0].id), undefined);
});
