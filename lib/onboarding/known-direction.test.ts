import { test } from "node:test";
import assert from "node:assert/strict";

import { knownDirection } from "@/lib/onboarding/known-direction";

test("a known role title is recognised", () => {
  assert.ok(knownDirection("Data Analyst"));
  assert.ok(knownDirection("analyst"));
});

test("a short or invented phrase is taken as written", () => {
  assert.equal(knownDirection("ab"), null);
  assert.equal(knownDirection("phi hành gia"), null);
});
