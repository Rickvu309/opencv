// A cover letter is paragraphs, and the whole point of the model is that the
// Coach can rewrite one of them without touching the rest. These tests are
// mostly about that: what happens to paragraph 2 when paragraph 3 changes.

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyAction } from "@/lib/actions/registry";
import { seedState } from "@/lib/actions/seed";
import type { AppState } from "@/lib/actions/types";
import { fileStem, toMarkdown, toPlainText } from "@/lib/paper/letter-export";
import { bodyFrom, isEmptyLetter, paragraphsOf } from "@/lib/paper/letter";

const LETTER = [
  "Kính gửi anh chị,",
  "Em là sinh viên năm cuối ngành Kinh tế.",
  "Em mong được trao đổi thêm.",
].join("\n\n");

/** A state holding one cover letter, and the letter's id. */
function withLetter(body = LETTER): { state: AppState; id: string } {
  const { state } = applyAction(seedState(), "paper.create", {
    type: "letter",
    label: "Thư cho VNG",
    targetRole: "Data Analyst",
    body,
  });
  return { state, id: state.paper[0].id };
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
    type: "letter",
    label: "Chưa viết",
  });
  assert.equal(isEmptyLetter(state.paper[0]), true);
  assert.equal(isEmptyLetter({ ...state.paper[0], body: "  \n \n " }), true);
  assert.equal(isEmptyLetter({ ...state.paper[0], body: "Kính gửi" }), false);
});

/* ── The actions ────────────────────────────────────────────────────────── */

test("a new document is English unless told otherwise", () => {
  const paper = applyAction(seedState(), "paper.create", {
    type: "letter",
    label: "Letter",
  }).state;
  assert.equal(paper.paper[0].language, "en");

  const vi = applyAction(seedState(), "paper.create", {
    type: "letter",
    label: "Thư",
    language: "vi",
  }).state;
  assert.equal(vi.paper[0].language, "vi");
  assert.equal(vi.locale, "en");
});

test("documents get their own ids, and a Proof is not a letter", () => {
  let state = seedState();
  state = applyAction(state, "paper.create", { type: "letter", label: "A" }).state;
  state = applyAction(state, "paper.create", { type: "proof", label: "B" }).state;

  assert.equal(state.paper.length, 2);
  assert.notEqual(state.paper[0].id, state.paper[1].id);
  assert.equal(state.paper[0].type, "letter");
  assert.equal(state.paper[1].type, "proof");
});

test("rewriting one paragraph leaves the others exactly as they were", () => {
  const { state, id } = withLetter();
  const after = applyAction(state, "paper.updateParagraph", {
    id,
    index: 2,
    text: "Em là sinh viên năm cuối ngành Khoa học Dữ liệu.",
  }).state;

  const paragraphs = paragraphsOf(after.paper[0].body);
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
  assert.equal(after.paper[0].body, LETTER);
});

test("an edit aimed at a document that is gone changes nothing", () => {
  const { state } = withLetter();
  const after = applyAction(state, "paper.updateParagraph", {
    id: "paper-99",
    index: 1,
    text: "x",
  }).state;
  assert.deepEqual(after.paper, state.paper);
});

test("a paragraph can be added at the end or at a position", () => {
  const { state, id } = withLetter();

  const appended = applyAction(state, "paper.addParagraph", {
    id,
    text: "Em xin cảm ơn.",
  }).state;
  assert.equal(paragraphsOf(appended.paper[0].body).at(-1), "Em xin cảm ơn.");

  const first = applyAction(state, "paper.addParagraph", {
    id,
    text: "Chào anh chị,",
    at: 1,
  }).state;
  assert.equal(paragraphsOf(first.paper[0].body)[0], "Chào anh chị,");
});

test("a paragraph can be removed and reordered", () => {
  const { state, id } = withLetter();

  const shorter = applyAction(state, "paper.removeParagraph", { id, index: 2 }).state;
  assert.deepEqual(paragraphsOf(shorter.paper[0].body), [
    "Kính gửi anh chị,",
    "Em mong được trao đổi thêm.",
  ]);

  const moved = applyAction(state, "paper.moveParagraph", { id, index: 3, by: -1 }).state;
  assert.deepEqual(paragraphsOf(moved.paper[0].body), [
    "Kính gửi anh chị,",
    "Em mong được trao đổi thêm.",
    "Em là sinh viên năm cuối ngành Kinh tế.",
  ]);
});

test("every edit restamps the document, so the card cannot lie", () => {
  const { state, id } = withLetter();
  const stale = {
    ...state,
    paper: [{ ...state.paper[0], updatedAt: "2 tuần trước" }],
  };
  const after = applyAction(stale, "paper.updateParagraph", {
    id,
    index: 1,
    text: "Kính gửi quý công ty,",
  }).state;
  assert.equal(after.paper[0].updatedAt, "Just now");
});

test("renaming changes the label without touching the text", () => {
  const { state, id } = withLetter();
  const after = applyAction(state, "paper.rename", { id, label: "Thư cho Shopee" }).state;
  assert.equal(after.paper[0].label, "Thư cho Shopee");
  assert.equal(after.paper[0].body, LETTER);
});

test("removing a document leaves the others", () => {
  let { state } = withLetter();
  state = applyAction(state, "paper.create", {
    type: "proof",
    label: "Dự án tốt nghiệp",
  }).state;

  const after = applyAction(state, "paper.remove", { id: state.paper[0].id }).state;
  assert.equal(after.paper.length, 1);
  assert.equal(after.paper[0].label, "Dự án tốt nghiệp");
});

/* ── Export ─────────────────────────────────────────────────────────────── */

test("Markdown carries the label, the role and every paragraph", () => {
  const { state } = withLetter();
  const markdown = toMarkdown(state.paper[0]);

  assert.match(markdown, /^# Thư cho VNG/);
  assert.match(markdown, /_Data Analyst_/);
  for (const paragraph of paragraphsOf(LETTER)) {
    assert.ok(markdown.includes(paragraph), `${paragraph} is missing`);
  }
});

test("plain text smuggles no formatting in", () => {
  const { state } = withLetter();
  const text = toPlainText(state.paper[0]);
  assert.equal(text.includes("#"), false);
  assert.equal(text.includes("_"), false);
  assert.ok(text.startsWith("Thư cho VNG"));
});

test("an empty document exports its heading and nothing else", () => {
  const { state } = applyAction(seedState(), "paper.create", {
    type: "letter",
    label: "Chưa viết",
  });
  assert.equal(toPlainText(state.paper[0]).trim(), "Chưa viết");
});

test("a filename survives Vietnamese and a filesystem", () => {
  const { state } = withLetter();
  const stem = fileStem(state.paper[0]);
  assert.equal(stem, "Thu_cho_VNG_-_Data_Analyst".replace(/-/g, "_").replace(/__+/g, "_"));
  assert.match(stem, /^[A-Za-z0-9_]+$/, "no accents and no separators");
});

test("a document with no usable label still gets a filename", () => {
  const { state } = applyAction(seedState(), "paper.create", {
    type: "letter",
    label: "。。。",
  });
  // Falls back to the kind, in the document's own language, because the file
  // lands beside other applications and "document.md" names nothing.
  assert.match(fileStem(state.paper[0]), /^[A-Za-zÀ-ỹ_-]+$/u);
  assert.ok(fileStem(state.paper[0]).length > 0);
});

test("addressing lives on the letter, not only in the label", () => {
  const { state, id } = withLetter();
  const after = applyAction(state, "paper.setLetterMeta", {
    id,
    org: "VNG",
    to: "hiring@vng.com.vn",
    subject: "Data intern",
  }).state.paper[0];
  assert.equal(after.type, "letter");
  if (after.type === "letter") {
    assert.equal(after.org, "VNG");
    assert.equal(after.to, "hiring@vng.com.vn");
    assert.equal(after.subject, "Data intern");
    assert.equal(after.body, LETTER);
  }
});

test("changing situation keeps typed words and replaces an unused scaffold", () => {
  const typed = withLetter();
  const afterTyped = applyAction(typed.state, "paper.setLetterSituation", {
    id: typed.id,
    situation: "scholarship",
  }).state.paper[0];
  assert.equal(afterTyped.type, "letter");
  if (afterTyped.type === "letter") {
    assert.equal(afterTyped.situation, "scholarship");
    assert.equal(afterTyped.body, LETTER);
  }

  const blank = applyAction(seedState(), "paper.create", {
    type: "letter",
    label: "Letter",
    situation: "posted",
  }).state;
  const id = blank.paper[0].id;
  const afterBlank = applyAction(blank, "paper.setLetterSituation", {
    id,
    situation: "speculative",
  }).state.paper[0];
  assert.equal(afterBlank.type, "letter");
  if (afterBlank.type === "letter") {
    assert.equal(afterBlank.situation, "speculative");
    assert.match(afterBlank.body, /Why this company/);
  }
});
