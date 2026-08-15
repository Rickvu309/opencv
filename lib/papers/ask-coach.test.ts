import { test } from "node:test";
import assert from "node:assert/strict";

import { messages } from "@/lib/i18n/messages";

const m = messages.papers;

test("AC-PAPERS-004.1: a letter with a role asks for that role by name", () => {
  const ask = m.askCoachLetterFor("Data Analyst");
  assert.ok(ask.includes("Data Analyst"), "the request drops the role");
  assert.match(ask, /cover letter/i);
});

test("a letter with no role still asks for a letter, not a document", () => {
  assert.match(m.askCoachLetter, /cover letter/i);
});

test("AC-PAPERS-005.1: the write-up request names all three parts", () => {
  assert.match(m.askCoachWriteUp, /what it was/i);
  assert.match(m.askCoachWriteUp, /what I did/i);
  assert.match(m.askCoachWriteUp, /came of it|resulted|result/i);
});

test("a letter request and a write-up request are not the same sentence", () => {
  assert.notEqual(m.askCoachLetter, m.askCoachWriteUp);
  assert.notEqual(m.askCoachLetterFor("X"), m.askCoachWriteUp);
});
