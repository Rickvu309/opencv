// The router decides what gets billed. That makes its edges worth stating in
// tests rather than discovering on an invoice.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RoutingError,
  SESSION_CEILINGS,
  candidates,
  newSessionLedger,
  policyFor,
  route,
  withinContext,
} from "@/lib/ai/router";
import { modelsFor } from "@/lib/ai/registry";

test("the default policy is the declared order, not the cheapest", () => {
  // The point of the contract: a free model that takes nine seconds is the
  // wrong answer for a greeting, however cheap. Cost wins only when asked.
  const preferred = candidates("conversational");
  const declared = modelsFor("conversational");
  assert.deepEqual(
    preferred.map((entry) => entry.id),
    declared.map((entry) => entry.id),
  );
});

test("the cheapest policy really picks the cheapest", () => {
  const cheapest = candidates("conversational", "cheapest");
  const prices = cheapest.map(
    (entry) => entry.cost.inputPerMillion + entry.cost.outputPerMillion,
  );
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("the fastest policy really picks the fastest", () => {
  const [first] = candidates("drafting", "fastest");
  assert.equal(first.latency, "low");
  // And the preferred order for drafting is not that, so the policy is doing
  // something rather than agreeing with the default by accident.
  assert.notEqual(route("drafting").id, first.id);
});

test("a role with no model is a configuration error, not a silent default", () => {
  assert.throws(
    // Deliberately outside the type, which is exactly the case a config typo
    // produces at runtime.
    () => candidates("summarising" as never),
    RoutingError,
  );
});

test("an oversized request is refused before it is sent", () => {
  const [model] = candidates("conversational");
  assert.equal(withinContext(model, model.contextWindowTokens), true);
  assert.equal(withinContext(model, model.contextWindowTokens + 1), false);
});

test("a fresh session is allowed", () => {
  assert.equal(newSessionLedger().verdict().kind, "allow");
});

test("a session near its ceiling is downgraded, not cut off", () => {
  const ledger = newSessionLedger();
  ledger.record({ inputTokens: SESSION_CEILINGS.inputTokens * 0.85 });
  const verdict = ledger.verdict();
  assert.equal(verdict.kind, "downgrade");
  assert.equal(policyFor(verdict), "cheapest");
});

test("a session at its ceiling is refused", () => {
  // The runaway-loop end state. Refusing is the honest answer; quietly billing
  // is not.
  const ledger = newSessionLedger();
  ledger.record({ outputTokens: SESSION_CEILINGS.outputTokens });
  const verdict = ledger.verdict();
  assert.equal(verdict.kind, "refuse");
  assert.equal(policyFor(verdict), null);
});

test("the ledger adds up what it was told", () => {
  const ledger = newSessionLedger();
  ledger.record({ inputTokens: 100, outputTokens: 20 });
  ledger.record({ inputTokens: 50 });
  assert.deepEqual(ledger.spent(), { inputTokens: 150, outputTokens: 20 });
});

test("either ceiling alone can stop a session", () => {
  // Output is the smaller budget and the one a loop burns first, so it has to
  // be enforced on its own rather than only in combination with input.
  const outputOnly = newSessionLedger();
  outputOnly.record({ outputTokens: SESSION_CEILINGS.outputTokens + 1 });
  assert.equal(outputOnly.verdict().kind, "refuse");

  const inputOnly = newSessionLedger();
  inputOnly.record({ inputTokens: SESSION_CEILINGS.inputTokens + 1 });
  assert.equal(inputOnly.verdict().kind, "refuse");
});
