import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { wordForTemplate } from "@/lib/paper/cv";
import { messages } from "@/lib/i18n/messages";
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

test("arrange keeps a why and the notes they picked", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const id = state.paper[0].id;
  state = applyAction(state, "paper.addNote", { id, text: "Keep" }).state;
  state = applyAction(state, "paper.addNote", { id, text: "Drop" }).state;
  const keep = state.paper[0];
  assert.ok(isProofPaper(keep));
  const keepId = keep.notes.find((note) => note.text === "Keep")?.id;
  state = applyAction(state, "paper.setProofMeta", {
    id,
    why: "To see if it worked.",
    arrangeNoteIds: keepId ? [keepId] : [],
  }).state;
  assert.ok(isProofPaper(state.paper[0]));
  assert.equal(state.paper[0].why, "To see if it worked.");
  assert.deepEqual(state.paper[0].arrangeNoteIds, keepId ? [keepId] : []);
});

test("a photo, file, or link is still a Proof note", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const id = state.paper[0].id;
  state = applyAction(state, "paper.addNote", {
    id,
    kind: "link",
    text: "Repo",
    url: "https://example.com",
  }).state;
  state = applyAction(state, "paper.addNote", {
    id,
    kind: "photo",
    fileName: "shift.jpg",
  }).state;
  state = applyAction(state, "paper.addNote", {
    id,
    kind: "file",
    fileName: "lab.pdf",
  }).state;
  assert.ok(isProofPaper(state.paper[0]));
  assert.equal(state.paper[0].notes[0]?.kind, "file");
  assert.equal(state.paper[0].notes[0]?.fileName, "lab.pdf");
  assert.equal(state.paper[0].notes[1]?.kind, "photo");
  assert.equal(state.paper[0].notes[2]?.kind, "link");
  assert.equal(state.paper[0].notes[2]?.url, "https://example.com");
});

test("unpublish clears the URL and leaves the space", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const id = state.paper[0].id;
  state = applyAction(state, "paper.addNote", { id, text: "Shipped" }).state;
  state = applyAction(state, "paper.publishProof", { id, slug: "campus-app" }).state;
  state = applyAction(state, "paper.unpublishProof", { id }).state;
  assert.ok(isProofPaper(state.paper[0]));
  assert.equal(state.paper[0].published, undefined);
  assert.equal(state.paper[0].notes.length, 1);
});

test("republish stamps a URL again without deleting the space", () => {
  let state = applyAction(seedState(), "paper.create", {
    type: "proof",
    label: "Campus app",
  }).state;
  const id = state.paper[0].id;
  state = applyAction(state, "paper.addNote", { id, text: "Shipped" }).state;
  state = applyAction(state, "paper.publishProof", { id, slug: "campus-app" }).state;
  state = applyAction(state, "paper.unpublishProof", { id }).state;
  state = applyAction(state, "paper.publishProof", { id, slug: "campus-app" }).state;
  assert.ok(isProofPaper(state.paper[0]));
  assert.equal(state.paper[0].published?.slug, "campus-app");
  assert.equal(state.paper[0].notes[0]?.text, "Shipped");
});

test("deleting an upload leaves the built CV", () => {
  let state = applyAction(seedState(), "paper.addUpload", {
    kind: "cv",
    label: "Old CV",
    fileName: "ha.pdf",
  }).state;
  state = applyAction(state, "paper.create", {
    type: "cv",
    label: "CV 1",
    fromProfile: false,
  }).state;
  const uploadId = state.uploads[0]?.id;
  assert.ok(uploadId);
  state = applyAction(state, "paper.removeUpload", { id: uploadId }).state;
  assert.equal(state.uploads.length, 0);
  assert.equal(state.paper.length, 1);
  assert.equal(state.paper[0]?.type, "cv");
});

test("wordForTemplate follows the audience", () => {
  assert.equal(wordForTemplate("classic"), "CV");
  assert.equal(wordForTemplate("internship"), "CV");
  assert.equal(wordForTemplate("modern"), "Resume");
  assert.equal(wordForTemplate("design"), "Resume");
});

test("the Proof space and band never say dump or Prepare", () => {
  const proof = messages.paper.proof;
  for (const line of [
    proof.emptyTitle,
    proof.emptyBody,
    proof.chipNone,
    proof.arrange,
    proof.publish,
    proof.unpublish,
    proof.addNote,
    proof.addPhoto,
    proof.addFile,
    proof.addLink,
  ]) {
    assert.doesNotMatch(line, /dump/i);
    assert.doesNotMatch(line, /\bPrepare\b/);
  }
});
