// The suite's job is to notice the Coach getting worse. The failure mode worth
// testing hardest is the opposite: a suite that reports a healthy average
// because it could not judge, which is how a quality system becomes a
// decoration.

import { test } from "node:test";
import assert from "node:assert/strict";

import { populated } from "@/lib/actions/fixture";
import { DRIFT_THRESHOLD, MIN_SAMPLE, detectDrift, rates } from "@/lib/eval/drift";
import { passed, scoreTurn } from "@/lib/eval/rubric";
import type { AgentTrace } from "@/lib/trace/types";

const state = populated();

test("a clean turn scores clean on everything judgeable", () => {
  const score = scoreTurn({
    reply:
      "Với vị trí data analyst, hai thứ nhà tuyển dụng nhìn đầu tiên là SQL và một dự án thật.",
    state,
  });
  assert.equal(passed(score), true);
  assert.equal(score.overall, 1);
});

test("relevance is scored null, never optimistically", () => {
  // A suite that scored relevance as perfect because it cannot read would
  // report a rising average every time the Coach got more irrelevant.
  const score = scoreTurn({ reply: "Chào bạn.", state });
  const relevance = score.scores.find((s) => s.dimension === "relevance");
  assert.equal(relevance?.score, null);
  assert.match(relevance?.detail ?? "", /judge/);
});

test("a false claim of action scores zero on action honesty", () => {
  const score = scoreTurn({
    reply: "Mình đã cập nhật CV của bạn.",
    toolResults: [],
    state,
  });
  const honesty = score.scores.find((s) => s.dimension === "action-honesty");
  assert.equal(honesty?.score, 0);
  assert.equal(passed(score), false);
});

test("the same claim after a successful action scores clean", () => {
  const score = scoreTurn({
    reply: "Mình đã cập nhật CV của bạn.",
    toolResults: [{ action: "paper.rename", ok: true }],
    state,
  });
  assert.equal(passed(score), true);
});

test("an invented number scores zero on groundedness", () => {
  const score = scoreTurn({
    reply: "Bạn đã giảm 40% thời gian làm báo cáo.",
    state,
  });
  assert.equal(
    score.scores.find((s) => s.dimension === "groundedness")?.score,
    0,
  );
});

test("any zero fails the turn, rather than being averaged away", () => {
  // Three clean dimensions and one violation is not a 75% pass. The violation
  // is the thing that happened.
  const score = scoreTurn({
    reply: "Mình đã cập nhật CV của bạn.",
    toolResults: [],
    state,
  });
  assert.ok((score.overall ?? 0) > 0, "the average is still above zero");
  assert.equal(passed(score), false);
});

/** A trace with only the field drift reads. */
const trace = (outcome: AgentTrace["outcome"]): AgentTrace => ({
  id: Math.random().toString(36),
  accountId: "a",
  startedAt: 0,
  endedAt: null,
  durationMs: null,
  model: null,
  costUsd: null,
  outcome,
  spans: [],
});

const many = (outcome: AgentTrace["outcome"], n: number) =>
  Array.from({ length: n }, () => trace(outcome));

test("the undo rate counts only turns that decided something", () => {
  const summary = rates([
    ...many("applied", 8),
    ...many("undone", 2),
    ...many("pending", 40),
  ]);
  assert.equal(summary.undoRate, 0.2);
  assert.equal(summary.turns, 50);
});

test("nothing to decide is null, not zero", () => {
  // Zero would say "nobody undid anything", which is a claim. Null says
  // nothing happened worth measuring.
  assert.equal(rates(many("pending", 10)).undoRate, null);
});

test("a small window says so instead of guessing", () => {
  // Reporting "not enough data" as "fine" is how a quiet week gets mistaken
  // for a healthy one.
  const verdict = detectDrift(
    [...many("applied", 5), ...many("undone", 1)],
    [...many("applied", 90), ...many("undone", 10)],
  );
  assert.equal(verdict.kind, "insufficient");
});

test("no baseline is insufficient, not ok", () => {
  const verdict = detectDrift(
    [...many("applied", 90), ...many("undone", 10)],
    [],
  );
  assert.equal(verdict.kind, "insufficient");
});

test("a steady undo rate is ok", () => {
  const verdict = detectDrift(
    [...many("applied", 90), ...many("undone", 10)],
    [...many("applied", 90), ...many("undone", 10)],
  );
  assert.equal(verdict.kind, "ok");
});

test("a real jump in the undo rate is drift", () => {
  const verdict = detectDrift(
    [...many("applied", 60), ...many("undone", 40)],
    [...many("applied", 90), ...many("undone", 10)],
  );
  assert.equal(verdict.kind, "drift");
  assert.match(verdict.kind === "drift" ? verdict.reason : "", /undo rate rose/);
});

test("a small absolute rise is not an alert", () => {
  // 1% to 2% is a 100% relative rise and nobody should be woken for it.
  const verdict = detectDrift(
    [...many("applied", 198), ...many("undone", 2)],
    [...many("applied", 199), ...many("undone", 1)],
  );
  assert.equal(verdict.kind, "ok");
});

test("the thresholds are stated, not scattered", () => {
  assert.ok(MIN_SAMPLE > 0);
  assert.ok(DRIFT_THRESHOLD > 0 && DRIFT_THRESHOLD < 1);
});
