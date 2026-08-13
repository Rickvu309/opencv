// Assignment has one job and one failure mode: a user whose variant changes
// under them. That is not a cosmetic bug, it is an experiment measuring noise,
// so stability is what these check hardest.

import { test } from "node:test";
import assert from "node:assert/strict";

import { assign, bucket, inRollout, type Experiment } from "@/lib/flags/assign";

const split: Experiment = {
  key: "colour",
  variants: [
    { name: "control", weight: 1 },
    { name: "treatment", weight: 1 },
  ],
};

test("the same user gets the same variant, every time", () => {
  const first = assign(split, "account-42");
  for (let i = 0; i < 50; i += 1) {
    assert.equal(assign(split, "account-42"), first);
  }
});

test("two experiments do not share a bucket", () => {
  // Without the experiment key in the hash, a user in the top decile would land
  // in the same bucket of every experiment at once, and two experiments running
  // together would be measuring each other.
  const subjects = Array.from({ length: 200 }, (_, i) => `account-${i}`);
  const a = subjects.map((s) => bucket("experiment-a", s) < 0.5);
  const b = subjects.map((s) => bucket("experiment-b", s) < 0.5);
  const agreements = a.filter((value, i) => value === b[i]).length;
  // Independent coin flips agree about half the time. Anything near 200 would
  // mean the two experiments are the same coin.
  assert.ok(agreements > 70 && agreements < 130, `agreed ${agreements}/200`);
});

test("weights are respected, roughly", () => {
  const weighted: Experiment = {
    key: "policy",
    variants: [
      { name: "preferred", weight: 9 },
      { name: "cheapest", weight: 1 },
    ],
  };
  const subjects = Array.from({ length: 2_000 }, (_, i) => `a-${i}`);
  const cheap = subjects.filter((s) => assign(weighted, s) === "cheapest").length;
  // 10% of 2000 is 200. A wide band, because this asserts the split is real
  // rather than that the hash is uniform to three decimal places.
  assert.ok(cheap > 130 && cheap < 280, `cheapest got ${cheap}/2000`);
});

test("an anonymous visitor gets the control, not a coin toss", () => {
  // A session that reshuffled on every request would be an experiment
  // measuring nothing.
  assert.equal(assign(split, null), "control");
});

test("an experiment with no variants is a configuration error", () => {
  assert.throws(() => assign({ key: "empty", variants: [] }, "a"));
});

test("zero weights fall back to the control rather than dividing by zero", () => {
  const broken: Experiment = {
    key: "broken",
    variants: [
      { name: "control", weight: 0 },
      { name: "treatment", weight: 0 },
    ],
  };
  assert.equal(assign(broken, "account-1"), "control");
});

test("a rollout keeps the same people in it", () => {
  // A flag on for 10% has to be on for the same 10% tomorrow, or the feature
  // flickers for everyone.
  const inside = Array.from({ length: 500 }, (_, i) => `a-${i}`).filter((s) =>
    inRollout("trace-turns", s, 10),
  );
  for (const subject of inside) {
    assert.equal(inRollout("trace-turns", subject, 10), true);
  }
  assert.ok(inside.length > 25 && inside.length < 80, `${inside.length}/500`);
});

test("a rollout widening never drops anybody who was already in", () => {
  // The property that makes a gradual rollout gradual rather than a reshuffle.
  const subjects = Array.from({ length: 300 }, (_, i) => `a-${i}`);
  for (const subject of subjects) {
    if (inRollout("f", subject, 10)) {
      assert.equal(inRollout("f", subject, 50), true, subject);
    }
  }
});

test("0 and 100 percent are absolute", () => {
  assert.equal(inRollout("f", "anyone", 0), false);
  assert.equal(inRollout("f", "anyone", 100), true);
  // Including for an anonymous visitor, who is otherwise always out.
  assert.equal(inRollout("f", null, 100), true);
  assert.equal(inRollout("f", null, 50), false);
});
