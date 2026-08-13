// REQ-PITCH-001, 002 and 003. The rule worth testing hardest is the one the
// screen must not be trusted to enforce: a person has one bio and one
// self-introduction, and any number of interview answers.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import { answersOf, isSingletonPitchKind, singletonOf } from "@/lib/pitch/types";

test("a new account has nothing to say yet", () => {
  assert.deepEqual(seedState().pitch, []);
});

test("AC-PITCH-001.2: the bio can be written and then edited", () => {
  let state = seedState();
  state = applyAction(state, "pitch.write", {
    kind: "bio",
    body: "Sinh viên năm cuối ngành Kinh tế, đang chuyển hướng sang phân tích dữ liệu.",
  }).state;

  const bio = singletonOf(state.pitch, "bio");
  assert.ok(bio, "the bio was not saved");
  assert.match(bio.body, /phân tích dữ liệu/);

  state = applyAction(state, "pitch.update", {
    id: bio.id,
    body: "Sinh viên năm cuối, đang học SQL và Python.",
  }).state;
  assert.match(singletonOf(state.pitch, "bio")!.body, /SQL/);
  assert.equal(state.pitch.length, 1, "editing must not add a second bio");
});

test("AC-PITCH-001.3: the bio is words, and the profile link is a fact", () => {
  // The two must not duplicate. A LinkedIn URL is a fact in the profile; the
  // bio that goes on LinkedIn is words, and lives here.
  let state = seedState();
  state = applyAction(state, "pitch.write", { kind: "bio", body: "Mình là Mai." }).state;
  state = applyAction(state, "document.add", {
    kind: "linkedin",
    label: "LinkedIn",
    url: "https://linkedin.com/in/mai",
  }).state;

  assert.equal(state.pitch.length, 1);
  assert.equal(singletonOf(state.pitch, "bio")!.body, "Mình là Mai.");
  const link = state.profile.documents.find((d) => d.kind === "linkedin");
  assert.equal(link?.url, "https://linkedin.com/in/mai");
  // The bio does not carry the URL, and the document does not carry the words.
  assert.equal(singletonOf(state.pitch, "bio")!.body.includes("linkedin.com"), false);
});

test("AC-PITCH-002.2: writing the self-introduction twice replaces it", () => {
  let state = seedState();
  state = applyAction(state, "pitch.write", { kind: "intro", body: "Bản nháp đầu." }).state;
  const firstId = singletonOf(state.pitch, "intro")!.id;

  state = applyAction(state, "pitch.write", { kind: "intro", body: "Bản đã sửa." }).state;

  assert.equal(state.pitch.length, 1, "a second self-introduction was created");
  assert.equal(singletonOf(state.pitch, "intro")!.body, "Bản đã sửa.");
  assert.equal(
    singletonOf(state.pitch, "intro")!.id,
    firstId,
    "the id should survive a rewrite, or every screen watching it loses its place",
  );
});

test("the bio and the self-introduction are separate things", () => {
  let state = seedState();
  state = applyAction(state, "pitch.write", { kind: "bio", body: "Bio." }).state;
  state = applyAction(state, "pitch.write", { kind: "intro", body: "Intro." }).state;

  assert.equal(state.pitch.length, 2);
  assert.equal(singletonOf(state.pitch, "bio")!.body, "Bio.");
  assert.equal(singletonOf(state.pitch, "intro")!.body, "Intro.");
});

test("AC-PITCH-003.2 and 003.3: the answer bank holds many, each editable", () => {
  let state = seedState();
  for (const [prompt, body] of [
    ["Điểm yếu của bạn là gì?", "Mình hay ôm việc."],
    ["Vì sao chọn ngành này?", "Vì mình thích tìm quy luật trong số liệu."],
    ["Kể về một lần thất bại.", "Kỳ thực tập đầu tiên."],
  ]) {
    state = applyAction(state, "pitch.write", { kind: "answer", prompt, body }).state;
  }

  const answers = answersOf(state.pitch);
  assert.equal(answers.length, 3, "answers must accumulate, not replace");
  assert.equal(new Set(answers.map((a) => a.id)).size, 3, "each answer needs its own id");
  assert.equal(answers[0].prompt, "Điểm yếu của bạn là gì?");

  // Edited later, which is the whole point of a bank.
  state = applyAction(state, "pitch.update", {
    id: answers[0].id,
    body: "Mình hay ôm việc, nên giờ mình chia nhỏ và báo tiến độ sớm.",
  }).state;
  assert.match(answersOf(state.pitch)[0].body, /chia nhỏ/);

  // And removed when they are no longer wanted.
  state = applyAction(state, "pitch.remove", { id: answers[1].id }).state;
  const left = answersOf(state.pitch);
  assert.equal(left.length, 2);
  assert.equal(
    left.some((a) => a.prompt === "Vì sao chọn ngành này?"),
    false,
  );
});

test("removing an answer leaves the bio alone", () => {
  let state = seedState();
  state = applyAction(state, "pitch.write", { kind: "bio", body: "Bio." }).state;
  state = applyAction(state, "pitch.write", {
    kind: "answer",
    prompt: "Q",
    body: "A",
  }).state;

  const answer = answersOf(state.pitch)[0];
  state = applyAction(state, "pitch.remove", { id: answer.id }).state;

  assert.equal(answersOf(state.pitch).length, 0);
  assert.ok(singletonOf(state.pitch, "bio"), "the bio went with the answer");
});

test("an item carries its own language, not the app's", () => {
  let state = seedState("vi");
  state = applyAction(state, "pitch.write", { kind: "bio", body: "Xin chào." }).state;
  assert.equal(singletonOf(state.pitch, "bio")!.language, "vi");

  // Interviewing in English while reading the app in Vietnamese.
  state = applyAction(state, "pitch.write", {
    kind: "answer",
    prompt: "Tell me about yourself",
    body: "I am a final-year economics student.",
    language: "en",
  }).state;
  assert.equal(answersOf(state.pitch)[0].language, "en");
  assert.equal(state.locale, "vi", "the app's language must not have moved");
});

test("an edit aimed at an item that is gone changes nothing", () => {
  const state = applyAction(seedState(), "pitch.write", {
    kind: "bio",
    body: "Bio.",
  }).state;
  const after = applyAction(state, "pitch.update", { id: "pitch-99", body: "x" }).state;
  assert.deepEqual(after.pitch, state.pitch);
});

test("only the bio and the self-introduction are singletons", () => {
  assert.equal(isSingletonPitchKind("bio"), true);
  assert.equal(isSingletonPitchKind("intro"), true);
  assert.equal(isSingletonPitchKind("answer"), false);
});
