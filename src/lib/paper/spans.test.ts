import { test } from "node:test";
import assert from "node:assert/strict";

import { parseDates, sentenceForSite, spanFromSnapshot, spansByYear } from "./spans";
import type { ProofSnapshot } from "./share";

test("a year range becomes a span, not a day grid", () => {
  const parsed = parseDates("Jun 2025 – Sep 2025");
  assert.ok(parsed);
  assert.equal(parsed.year, 2025);
  assert.ok(parsed.end > parsed.start);
});

test("missing dates become a tick on the publish day", () => {
  const snapshot: ProofSnapshot = {
    title: "Shift",
    notes: [],
    publishedAt: "2026-08-15T10:00:00.000Z",
  };
  const span = spanFromSnapshot("shift", snapshot);
  assert.equal(span.tick, true);
  assert.equal(span.year, 2026);
});

test("the personal link is a sentence, not a day grid", () => {
  const snapshot: ProofSnapshot = {
    title: "Lab",
    dates: "2024",
    notes: [],
    publishedAt: "2026-01-01T00:00:00.000Z",
  };
  const spans = [spanFromSnapshot("lab", snapshot)];
  assert.equal(sentenceForSite("Hà", spans), "Hà published work in 2024.");
  assert.equal(sentenceForSite("Hà", []), "Hà has not published work yet.");
});

test("a note's log day does not place the span", () => {
  const snapshot: ProofSnapshot = {
    title: "Shift",
    notes: [{ text: "Logged", at: "2024-01-01" }],
    publishedAt: "2026-08-15T10:00:00.000Z",
  };
  const span = spanFromSnapshot("shift", snapshot);
  assert.equal(span.year, 2026);
  assert.equal(span.tick, true);
});

test("years with no work do not appear", () => {
  const snapshot: ProofSnapshot = {
    title: "Lab",
    dates: "2024",
    notes: [],
    publishedAt: "2026-01-01T00:00:00.000Z",
  };
  const years = spansByYear([spanFromSnapshot("lab", snapshot)]);
  assert.deepEqual([...years.keys()], [2024]);
});
