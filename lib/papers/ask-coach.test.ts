// WO-38: the request the papers screen hands the Coach.
//
// The acceptance criteria say the Coach drafts a letter "for a role" and a
// write-up covering three things. A generic "write a draft of this document"
// leaves both to chance, so what the button sends is worth testing directly.

import { test } from "node:test";
import assert from "node:assert/strict";

import { messages } from "@/lib/i18n/messages";
import { locales } from "@/lib/i18n/locale";

const m = messages.papers;

test("AC-PAPERS-004.1: a letter with a role asks for that role by name", () => {
  const ask = m.askCoachLetterFor("Data Analyst");
  for (const locale of locales) {
    assert.ok(
      ask[locale].includes("Data Analyst"),
      `the ${locale} request drops the role`,
    );
  }
  assert.match(ask.en, /cover letter/i);
  assert.match(ask.vi, /thư xin việc/i);
});

test("a letter with no role still asks for a letter, not a document", () => {
  assert.match(m.askCoachLetter.en, /cover letter/i);
  assert.match(m.askCoachLetter.vi, /thư xin việc/i);
});

test("AC-PAPERS-005.1: the write-up request names all three parts", () => {
  // What it was, what the user did, what resulted. Ask for fewer and the Coach
  // returns a summary rather than a story.
  assert.match(m.askCoachWriteUp.en, /what it was/i);
  assert.match(m.askCoachWriteUp.en, /what I did/i);
  assert.match(m.askCoachWriteUp.en, /came of it|resulted|result/i);

  assert.match(m.askCoachWriteUp.vi, /dự án là gì/i);
  assert.match(m.askCoachWriteUp.vi, /mình đã làm gì/i);
  assert.match(m.askCoachWriteUp.vi, /kết quả/i);
});

test("a letter request and a write-up request are not the same sentence", () => {
  // The whole point of the fix: the Coach can tell which of the two it is
  // holding from the request alone.
  for (const locale of locales) {
    assert.notEqual(m.askCoachLetter[locale], m.askCoachWriteUp[locale]);
    assert.notEqual(m.askCoachLetterFor("X")[locale], m.askCoachWriteUp[locale]);
  }
});

test("AC-PAPERS-009.2: every request exists in both languages, so it can be sent in the document's", () => {
  // The screen indexes these by `paper.language`, not by the app locale. That
  // only works if both languages are really written.
  for (const ask of [m.askCoachLetter, m.askCoachLetterFor("Data Analyst"), m.askCoachWriteUp]) {
    for (const locale of locales) {
      assert.ok(ask[locale].trim().length > 0, `missing ${locale}`);
    }
    assert.notEqual(ask.vi, ask.en, "one language is a copy of the other");
  }
});
