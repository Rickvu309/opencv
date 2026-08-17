// "We built the guards" is not "the guards work". This runs the adversarial
// set and requires every case to end where the requirement says it should.
//
// It is a different question from the guards' own unit tests. Those were
// written beside the code by whoever wrote it. These are written from the
// acceptance criteria, by somebody trying to get through.

import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import { CONFORMANCE_SET, coveredCriteria } from "@/lib/guardrails/conformance";
import { runConformance } from "@/lib/guardrails/conformance.run";
import { newCollector } from "@/lib/trace/collector";

const state = populated();

test("every case in the set ends where the requirement says it should", () => {
  const report = runConformance({ state });
  assert.deepEqual(
    report.failed.map((result) => `${result.id}: wanted ${result.expected}, got ${result.actual}`),
    [],
  );
  assert.equal(report.passed, CONFORMANCE_SET.length);
});

test("every Trustworthy Coach criterion has a case", () => {
  // A criterion with no case is a promise nothing checks. This list is the
  // work order's own scope, so a criterion added later fails here until
  // somebody writes the case for it.
  assert.deepEqual(coveredCriteria(), [
    "AC-TRUST-001.1",
    "AC-TRUST-001.2",
    "AC-TRUST-001.3",
    "AC-TRUST-002.1",
    "AC-TRUST-002.2",
    "AC-TRUST-003.1",
    "AC-TRUST-003.2",
    "AC-TRUST-004.1",
    "AC-TRUST-004.2",
    "AC-TRUST-004.3",
  ]);
});

test("the set is adversarial and innocent in roughly equal measure", () => {
  // The reason the twins are there: a guard that refuses everything passes
  // every hostile case. Only the innocent ones can tell a guard from a wall.
  const innocent = CONFORMANCE_SET.filter((entry) => entry.expected === "allowed");
  const hostile = CONFORMANCE_SET.filter((entry) => entry.expected !== "allowed");
  assert.ok(innocent.length >= 8, "not enough innocent twins to catch a wall");
  assert.ok(hostile.length >= 8, "not enough adversarial cases to catch a sieve");
});

test("a guard turned off fails the set rather than passing it quietly", () => {
  // Proof that the set has teeth. With strictness off, nothing is refused, and
  // every hostile case should fail.
  const report = runConformance({ state, config: { strictness: "off" } });
  const hostile = CONFORMANCE_SET.filter(
    (entry) => entry.expected !== "allowed" && entry.id !== "budget-oversized",
  );
  assert.equal(
    report.failed.length,
    hostile.length,
    "turning the guards off should fail every hostile case except the budget one, which is not a guard",
  );
});

test("failures are recorded as violations, not only counted", () => {
  // So a regression appears where the live refusals appear, rather than only
  // in a test log somebody has to be looking at.
  const collector = newCollector();
  runConformance({ state, config: { strictness: "off" }, collector });
  const violations = collector.violations();
  assert.ok(violations.length > 0);
  assert.match(violations[0].rule, /^conformance:AC-TRUST-/);
});

test("a passing run records nothing", () => {
  const collector = newCollector();
  const report = runConformance({ state, collector });
  assert.equal(report.failed.length, 0);
  assert.equal(collector.violations().length, 0);
});

test("every case says why it is there", () => {
  // A case with no note is one nobody can maintain: the next person cannot
  // tell a deliberate edge from a typo.
  for (const entry of CONFORMANCE_SET) {
    assert.ok(entry.note.trim().length > 10, `${entry.id} has no useful note`);
    assert.ok(entry.message || entry.reply, `${entry.id} has no content`);
  }
});
