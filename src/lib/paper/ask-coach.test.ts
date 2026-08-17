import { test } from "node:test";
import assert from "node:assert/strict";

import { messages } from "@/lib/i18n/messages";

const m = messages.paper.letter;

test("AC-PAPERS-004.1: a letter with a role asks for that role by name", () => {
  const ask = m.askCoachLetterFor("Data Analyst");
  assert.ok(ask.includes("Data Analyst"), "the request drops the role");
  assert.match(ask, /cover letter/i);
});

test("a letter with no role still asks for a letter, not a document", () => {
  assert.match(m.askCoachLetter, /cover letter/i);
});

test("AC-PAPERS-005.1: the Proof request names all three parts", () => {
  assert.match(m.askCoachProof, /what it was/i);
  assert.match(m.askCoachProof, /what I did/i);
  assert.match(m.askCoachProof, /came of it|resulted|result/i);
});

test("a letter request and a Proof request are not the same sentence", () => {
  assert.notEqual(m.askCoachLetter, m.askCoachProof);
  assert.notEqual(m.askCoachLetterFor("X"), m.askCoachProof);
});
