// A cover letter is paragraphs, and the whole point of the model is that the
// Coach can rewrite one of them without touching the rest. These tests are
// mostly about that: what happens to paragraph 2 when paragraph 3 changes.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import type { AppState } from "@/lib/actions/types";
import { fileStem, toMarkdown, toPlainText } from "@/lib/papers/export";
import { bodyFrom, isEmptyPaper, paragraphsOf } from "@/lib/papers/types";

const LETTER = [
  "Kính gửi anh chị,",
  "Em là sinh viên năm cuối ngành Kinh tế.",
  "Em mong được trao đổi thêm.",
].join("\n\n");

/** A state holding one cover letter, and the letter's id. */
function withLetter(body = LETTER): { state: AppState; id: string } {
  const { state } = applyAction(seedState(), "paper.create", {
    kind: "cover-letter",
    label: "Thư cho VNG",
    targetRole: "Data Analyst",
    body,
  });
  return { state, id: state.papers[0].id };
}

/* ── Paragraphs ─────────────────────────────────────────────────────────── */

test("a blank line separates paragraphs, a single newline does not", () => {
  // The single newline matters: it is how somebody writes an address block or
  // a signature, and splitting on it would turn each line into a paragraph.
  assert.deepEqual(paragraphsOf("one\ntwo\n\nthree"), ["one\ntwo", "three"]);
  assert.deepEqual(paragraphsOf(""), []);
  assert.deepEqual(paragraphsOf("\n\n  \n\n"), []);
  // Trailing blank lines are what a textarea leaves behind; they are not an
  // empty paragraph the user has to notice and delete.
  assert.deepEqual(paragraphsOf("one\n\n\n\ntwo\n\n"), ["one", "two"]);
});

test("paragraphs round-trip through a body", () => {
  const paragraphs = ["one", "two", "three"];
  assert.deepEqual(paragraphsOf(bodyFrom(paragraphs)), paragraphs);
});

test("an empty document is recognised as empty", () => {
  const { state } = applyAction(seedState(), "paper.create", {
    kind: "cover-letter",
    label: "Chưa viết",
  });
  assert.equal(isEmptyPaper(state.papers[0]), true);
  assert.equal(isEmptyPaper({ ...state.papers[0], body: "  \n \n " }), true);
  assert.equal(isEmptyPaper({ ...state.papers[0], body: "Kính gửi" }), false);
});

/* ── The actions ────────────────────────────────────────────────────────── */

test("a new document is English unless told otherwise", () => {
  const paper = applyAction(seedState(), "paper.create", {
    kind: "cover-letter",
    label: "Letter",
  }).state;
  assert.equal(paper.papers[0].language, "en");

  const vi = applyAction(seedState(), "paper.create", {
    kind: "cover-letter",
    label: "Thư",
    language: "vi",
  }).state;
  assert.equal(vi.papers[0].language, "vi");
  assert.equal(vi.locale, "en");
});

test("documents get their own ids, and a write-up is not a letter", () => {
  let state = seedState();
  state = applyAction(state, "paper.create", { kind: "cover-letter", label: "A" }).state;
  state = applyAction(state, "paper.create", { kind: "project-write-up", label: "B" }).state;

  assert.equal(state.papers.length, 2);
  assert.notEqual(state.papers[0].id, state.papers[1].id);
  assert.equal(state.papers[0].kind, "cover-letter");
  assert.equal(state.papers[1].kind, "project-write-up");
});

test("rewriting one paragraph leaves the others exactly as they were", () => {
  const { state, id } = withLetter();
  const after = applyAction(state, "paper.updateParagraph", {
    id,
    index: 2,
    text: "Em là sinh viên năm cuối ngành Khoa học Dữ liệu.",
  }).state;

  const paragraphs = paragraphsOf(after.papers[0].body);
  assert.equal(paragraphs.length, 3);
  assert.equal(paragraphs[0], "Kính gửi anh chị,", "the first paragraph moved");
  assert.match(paragraphs[1], /Khoa học Dữ liệu/);
  assert.equal(paragraphs[2], "Em mong được trao đổi thêm.", "the last paragraph moved");
});

test("a paragraph number that does not exist changes nothing", () => {
  // A model that miscounted must not silently append. Doing nothing is the
  // answer the user can see and correct.
  const { state, id } = withLetter();
  const after = applyAction(state, "paper.updateParagraph", {
    id,
    index: 9,
    text: "somewhere else",
  }).state;
  assert.equal(after.papers[0].body, LETTER);
});

test("an edit aimed at a document that is gone changes nothing", () => {
  const { state } = withLetter();
  const after = applyAction(state, "paper.updateParagraph", {
    id: "paper-99",
    index: 1,
    text: "x",
  }).state;
  assert.deepEqual(after.papers, state.papers);
});

test("a paragraph can be added at the end or at a position", () => {
  const { state, id } = withLetter();

  const appended = applyAction(state, "paper.addParagraph", {
    id,
    text: "Em xin cảm ơn.",
  }).state;
  assert.equal(paragraphsOf(appended.papers[0].body).at(-1), "Em xin cảm ơn.");

  const first = applyAction(state, "paper.addParagraph", {
    id,
    text: "Chào anh chị,",
    at: 1,
  }).state;
  assert.equal(paragraphsOf(first.papers[0].body)[0], "Chào anh chị,");
});

test("a paragraph can be removed and reordered", () => {
  const { state, id } = withLetter();

  const shorter = applyAction(state, "paper.removeParagraph", { id, index: 2 }).state;
  assert.deepEqual(paragraphsOf(shorter.papers[0].body), [
    "Kính gửi anh chị,",
    "Em mong được trao đổi thêm.",
  ]);

  const moved = applyAction(state, "paper.moveParagraph", { id, index: 3, by: -1 }).state;
  assert.deepEqual(paragraphsOf(moved.papers[0].body), [
    "Kính gửi anh chị,",
    "Em mong được trao đổi thêm.",
    "Em là sinh viên năm cuối ngành Kinh tế.",
  ]);
});

test("every edit restamps the document, so the card cannot lie", () => {
  const { state, id } = withLetter();
  const stale = {
    ...state,
    papers: [{ ...state.papers[0], updatedAt: "2 tuần trước" }],
  };
  const after = applyAction(stale, "paper.updateParagraph", {
    id,
    index: 1,
    text: "Kính gửi quý công ty,",
  }).state;
  assert.equal(after.papers[0].updatedAt, "Just now");
});

test("renaming changes the label without touching the text", () => {
  const { state, id } = withLetter();
  const after = applyAction(state, "paper.rename", { id, label: "Thư cho Shopee" }).state;
  assert.equal(after.papers[0].label, "Thư cho Shopee");
  assert.equal(after.papers[0].body, LETTER);
});

test("removing a document leaves the others", () => {
  let { state } = withLetter();
  state = applyAction(state, "paper.create", {
    kind: "project-write-up",
    label: "Dự án tốt nghiệp",
  }).state;

  const after = applyAction(state, "paper.remove", { id: state.papers[0].id }).state;
  assert.equal(after.papers.length, 1);
  assert.equal(after.papers[0].label, "Dự án tốt nghiệp");
});

/* ── Export ─────────────────────────────────────────────────────────────── */

test("Markdown carries the label, the role and every paragraph", () => {
  const { state } = withLetter();
  const markdown = toMarkdown(state.papers[0]);

  assert.match(markdown, /^# Thư cho VNG/);
  assert.match(markdown, /_Data Analyst_/);
  for (const paragraph of paragraphsOf(LETTER)) {
    assert.ok(markdown.includes(paragraph), `${paragraph} is missing`);
  }
});

test("plain text smuggles no formatting in", () => {
  const { state } = withLetter();
  const text = toPlainText(state.papers[0]);
  assert.equal(text.includes("#"), false);
  assert.equal(text.includes("_"), false);
  assert.ok(text.startsWith("Thư cho VNG"));
});

test("an empty document exports its heading and nothing else", () => {
  const { state } = applyAction(seedState(), "paper.create", {
    kind: "cover-letter",
    label: "Chưa viết",
  });
  assert.equal(toPlainText(state.papers[0]).trim(), "Chưa viết");
});

test("a filename survives Vietnamese and a filesystem", () => {
  const { state } = withLetter();
  const stem = fileStem(state.papers[0]);
  assert.equal(stem, "Thu_cho_VNG_-_Data_Analyst".replace(/-/g, "_").replace(/__+/g, "_"));
  assert.match(stem, /^[A-Za-z0-9_]+$/, "no accents and no separators");
});

test("a document with no usable label still gets a filename", () => {
  const { state } = applyAction(seedState(), "paper.create", {
    kind: "project-write-up",
    label: "。。。",
  });
  // Falls back to the kind, in the document's own language, because the file
  // lands beside other applications and "document.md" names nothing.
  assert.match(fileStem(state.papers[0]), /^[A-Za-zÀ-ỹ_-]+$/u);
  assert.ok(fileStem(state.papers[0]).length > 0);
});
