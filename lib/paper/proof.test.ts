import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { wordForTemplate } from "@/lib/paper/cv";
import { isProofPaper } from "@/lib/paper/types";

test("a new Proof starts with no notes", () => {
  const state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const paper = state.paper[0];
  assert.ok(isProofPaper(paper));
  assert.deepEqual(paper.notes, []);
});

test("notes land newest first", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const id = state.paper[0].id;
  state = applyAction(state, "paper.addNote", { id, text: "First" }).state;
  state = applyAction(state, "paper.addNote", { id, text: "Second" }).state;
  assert.ok(isProofPaper(state.paper[0]));
  assert.deepEqual(
    state.paper[0].notes.map((note) => note.text),
    ["Second", "First"],
  );
});

test("publishing stamps a slug without deleting notes", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const id = state.paper[0].id;
  state = applyAction(state, "paper.addNote", { id, text: "Shipped" }).state;
  state = applyAction(state, "paper.publishProof", { id, slug: "campus-app" }).state;
  assert.ok(isProofPaper(state.paper[0]));
  assert.equal(state.paper[0].published?.slug, "campus-app");
  assert.equal(state.paper[0].notes.length, 1);
});

test("an upload is a row, not a paper", () => {
  const state = applyAction(seedState(), "paper.addUpload", {
    kind: "cv",
    label: "Old CV",
    fileName: "ha.pdf",
  }).state;
  assert.equal(state.paper.length, 0);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0]?.fileName, "ha.pdf");
});

test("wordForTemplate follows the audience", () => {
  assert.equal(wordForTemplate("classic"), "CV");
  assert.equal(wordForTemplate("internship"), "CV");
  assert.equal(wordForTemplate("modern"), "Resume");
  assert.equal(wordForTemplate("design"), "Resume");
});
