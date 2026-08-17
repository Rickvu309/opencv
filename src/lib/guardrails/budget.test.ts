// AC-TRUST-004.3, and the failure it prevents: a request that technically fits
// under the cap but leaves the model no room to answer, which reads to the user
// as a Coach that stopped mid-sentence.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SESSION_CEILINGS } from "@/lib/ai/router";
import { RESERVED_FOR_REPLY, estimateTokens, fitsBudget } from "@/lib/guardrails/budget";
import { guardrailConfig } from "@/lib/guardrails/config";

test("an ordinary question fits", () => {
  const verdict = fitsBudget({
    message: "Mình nên học gì tuần này để làm data analyst?",
    context: JSON.stringify({ profile: { name: "Quân" } }),
  });
  assert.equal(verdict.kind, "allow");
});

test("AC-TRUST-004.3: a request with no room for a reply is refused", () => {
  const verdict = fitsBudget({
    message: "x".repeat(3 * SESSION_CEILINGS.inputTokens),
  });
  assert.equal(verdict.kind, "refuse");
});

test("a session that has nearly spent its budget is refused a new turn", () => {
  const verdict = fitsBudget({
    message: "Ngắn thôi",
    spentInputTokens: SESSION_CEILINGS.inputTokens - 10,
  });
  assert.equal(verdict.kind, "refuse");
});

test("the reply's room is reserved, not merely hoped for", () => {
  // Exactly at the ceiling minus the reservation is the boundary. One token
  // over it and the model would have nothing left to answer with.
  const ceiling = 10_000;
  const room = ceiling - RESERVED_FOR_REPLY;
  const justFits = fitsBudget({ message: "x".repeat((room - 10) * 3), ceiling });
  const justDoesNot = fitsBudget({ message: "x".repeat((room + 10) * 3), ceiling });
  assert.equal(justFits.kind, "allow");
  assert.equal(justDoesNot.kind, "refuse");
});

test("a request larger than the model's window is refused too", () => {
  const verdict = fitsBudget({
    message: "x".repeat(60_000),
    contextWindowTokens: 8_000,
    ceiling: 1_000_000,
  });
  assert.equal(verdict.kind, "refuse");
  assert.match(verdict.kind === "refuse" ? verdict.reason : "", /context window/);
});

test("the estimate over-counts rather than under-counts", () => {
  // Low is the wrong direction to be wrong in for a budget check: it means
  // truncating a reply the user was waiting for. Four characters per token is
  // the usual English figure, and Vietnamese runs denser, so the estimate uses
  // three and is expected to sit above the English number.
  const text = "a".repeat(400);
  assert.ok(estimateTokens(text) > 400 / 4);
});

test("a broken config value is standard, never off", () => {
  // A typo in an environment variable must not be the thing that silently
  // disables the safety layer.
  assert.equal(guardrailConfig({ OPENPATH_GUARDRAILS: "loose" }).strictness, "standard");
  assert.equal(guardrailConfig({}).strictness, "standard");
  assert.equal(guardrailConfig({ OPENPATH_GUARDRAILS: "off" }).strictness, "off");
  assert.equal(guardrailConfig({ OPENPATH_GUARDRAILS: "strict" }).strictness, "strict");
});
