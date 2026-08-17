// The registry is configuration, and a configuration file with a typo in it
// fails at the worst possible moment: the first real turn after a deploy.
// These tests are the cheap version of that discovery.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_REGISTRY,
  REGISTERED_ROLES,
  modelsFor,
  type ModelRole,
} from "@/lib/ai/registry";

const ROLES: ModelRole[] = ["conversational", "drafting", "fast", "embedding"];

test("every role the product asks for has a model behind it", () => {
  for (const role of ROLES) {
    assert.ok(
      modelsFor(role).length > 0,
      `nothing is registered for the ${role} role`,
    );
  }
});

test("the conversational role has a fallback", () => {
  // The one role a user is sitting and waiting on. A provider outage with no
  // second model is a Coach that simply does not answer.
  assert.ok(
    modelsFor("conversational").length >= 2,
    "a provider outage on the Coach turn has nowhere to go",
  );
});

test("no model is registered without the metadata the router selects on", () => {
  for (const entry of MODEL_REGISTRY) {
    assert.ok(entry.id.trim().length > 0, "a model has no id");
    assert.ok(
      entry.contextWindowTokens > 0,
      `${entry.id} has no context window, so oversized requests cannot be caught`,
    );
    assert.ok(
      entry.cost.inputPerMillion >= 0 && entry.cost.outputPerMillion >= 0,
      `${entry.id} has a negative price`,
    );
    assert.ok(["low", "standard", "high"].includes(entry.latency));
  }
});

test("the drafting role leads with the slower, larger model", () => {
  // Deliberate: a cover letter is worth nine seconds, and the user is not
  // watching a cursor while it is written.
  const [first] = modelsFor("drafting");
  assert.equal(first.latency, "high");
});

test("the conversational role leads with the fast model", () => {
  const [first] = modelsFor("conversational");
  assert.equal(first.latency, "low");
});

test("the sampling that keeps stray scripts out of Vietnamese is still set", () => {
  // Temperature 1.0 put CJK and Cyrillic characters into Vietnamese replies in
  // 4 of 6 samples. This is the guard against someone tidying it away.
  for (const entry of modelsFor("conversational")) {
    assert.equal(entry.providerOptions.sampling?.temperature, 0.3);
  }
});

test("REGISTERED_ROLES reports what is really there", () => {
  for (const role of REGISTERED_ROLES) {
    assert.ok(modelsFor(role).length > 0);
  }
  assert.equal(new Set(REGISTERED_ROLES).size, REGISTERED_ROLES.length);
});
