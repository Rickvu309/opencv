import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { driveOf } from "./drive";

test("empty Drive has no filter and no rows", () => {
  const state = seedState();
  const drive = driveOf(state.paper, state.uploads);
  assert.equal(drive.empty, true);
  assert.equal(drive.uploadsOnly, false);
  assert.equal(drive.showFilter, false);
  assert.equal(drive.rows.length, 0);
});

test("uploads only is not an empty night", () => {
  const state = applyAction(seedState(), "paper.addUpload", {
    kind: "cv",
    label: "Old CV",
    fileName: "ha.pdf",
  }).state;
  const drive = driveOf(state.paper, state.uploads);
  assert.equal(drive.empty, false);
  assert.equal(drive.uploadsOnly, true);
  assert.equal(drive.showFilter, false);
  assert.equal(drive.rows.length, 1);
  assert.equal(drive.rows[0]?.kind, "upload");
});

test("one CV does not show a type filter", () => {
  const state = applyAction(seedState(), "paper.create", {
    type: "cv",
    label: "Tonight",
    fromProfile: false,
  }).state;
  const drive = driveOf(state.paper, state.uploads);
  assert.equal(drive.empty, false);
  assert.equal(drive.uploadsOnly, false);
  assert.equal(drive.showFilter, false);
  assert.equal(drive.rows[0]?.kind, "paper");
});

test("mixed types show a filter; a missing filter falls back to all", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "cv",
    label: "Tonight",
    fromProfile: false,
  }).state;
  state = applyAction(state, "paper.create", {
    type: "letter",
    label: "Cover",
  }).state;
  const mixed = driveOf(state.paper, state.uploads);
  assert.equal(mixed.showFilter, true);
  assert.equal(mixed.rows.length, 2);

  const letters = driveOf(state.paper, state.uploads, "letter");
  assert.equal(letters.filter, "letter");
  assert.equal(letters.rows.length, 1);
  assert.equal(letters.rows[0]?.kind, "paper");
  if (letters.rows[0]?.kind === "paper") {
    assert.equal(letters.rows[0].item.type, "letter");
  }

  const missing = driveOf(state.paper, state.uploads, "proof");
  assert.equal(missing.filter, "all");
  assert.equal(missing.rows.length, 2);
});

test("a CV beside an upload shows a type filter", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "cv",
    label: "Tonight",
    fromProfile: false,
  }).state;
  state = applyAction(state, "paper.addUpload", {
    kind: "cv",
    label: "Old CV",
    fileName: "ha.pdf",
  }).state;
  const drive = driveOf(state.paper, state.uploads);
  assert.equal(drive.showFilter, true);
  assert.equal(drive.uploadsOnly, false);
  assert.equal(drive.rows.length, 2);
});

test("four rows are airy; five are tight", () => {
  let state = seedState();
  for (let n = 1; n <= 4; n++) {
    state = applyAction(state, "paper.create", {
      type: "cv",
      label: `CV ${n}`,
      fromProfile: false,
    }).state;
  }
  assert.equal(driveOf(state.paper, state.uploads).airy, true);
  state = applyAction(state, "paper.create", {
    type: "cv",
    label: "CV 5",
    fromProfile: false,
  }).state;
  assert.equal(driveOf(state.paper, state.uploads).airy, false);
});
